import {registrySummary,domainModels,MODEL_REGISTRY,PACKAGE_STACKS,allModelIds} from "./model-registry.js";
import {runLocalModel,localModelMeta,LOCAL_MODELS} from "./local-models.js";
import {dispatch} from "./kaggle-official.js";
import {recipeFor,recipeMeta} from "./model-recipe-router.js";
import {commercialSpatialExecutableModel,commercialSpatialExecutableModelIds} from "./commercial-spatial-executable-models.js";
import {INDUSTRY_PACKS,STANDARD_WORKFLOWS,industrySummary,industryPack} from "./industry-packs.js";
const MAX_BODY_BYTES=65536,DEFAULT_RATE=30;
const REGISTRY_IDS=Object.freeze(allModelIds());
const REGISTRY_SET=new Set(REGISTRY_IDS);
const EXECUTABLE_SPATIAL_IDS=Object.freeze(commercialSpatialExecutableModelIds());
const EXECUTABLE_SPATIAL_SET=new Set(EXECUTABLE_SPATIAL_IDS);
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const error=(code,message,status=400,details)=>json({ok:false,error:code,message,...(details?{details}:{})},status);
const now=()=>new Date().toISOString();
const int=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d};
async function digest(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function parse(req){const n=Number(req.headers.get("content-length")||0);if(n>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});const t=await req.text();if(new TextEncoder().encode(t).length>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});try{return t?JSON.parse(t):{}}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
function gate(env,shard="global"){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName(shard))}
async function g(env,path,method="GET",body,shard="global"){const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);const r=await gate(env,shard).fetch(new Request(`https://gate.internal${path}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
export function canonicalModelId(raw){const s=String(raw||"").trim();if(!s)throw Object.assign(new Error("MODEL_ID_REQUIRED"),{status:400});if(LOCAL_MODELS[s])return{canonical:s,local_id:s,source:"local"};if(REGISTRY_SET.has(s))return{canonical:s,local_id:null,source:"registry"};if(EXECUTABLE_SPATIAL_SET.has(s))return{canonical:s,local_id:null,source:"approved-recipe-catalog"};const matches=REGISTRY_IDS.filter(x=>x.endsWith(`.${s}`));const spatialMatches=EXECUTABLE_SPATIAL_IDS.filter(x=>x.endsWith(`.${s}`));const all=[...new Set([...matches,...spatialMatches])];if(all.length===1)return{canonical:all[0],local_id:null,source:spatialMatches.includes(all[0])?"approved-recipe-alias":"registry-alias"};if(all.length>1)throw Object.assign(new Error("AMBIGUOUS_MODEL_ID"),{status:400,details:{model_id:s,matches:all.slice(0,25)}});throw Object.assign(new Error("UNKNOWN_MODEL"),{status:400,details:{model_id:s}})}
async function run(req,env){
  if(new URL(req.url).hostname!=="compute.internal")return error("POLICY_DENIED","Model execution is service-binding internal only",403);
  const rate=await g(env,"/rate","POST",{limit:int(env.RATE_LIMIT_PER_MIN,DEFAULT_RATE)});if(!rate.ok)return error("RATE_LIMITED","Compute budget exceeded",429,rate);
  const b=await parse(req),taskId=String(b.task_id||crypto.randomUUID()),resolved=canonicalModelId(b.model_id),modelId=resolved.canonical,args=b.input||b.args||{},timeout=Math.max(60,Math.min(900,int(b.timeout_seconds,300)));
  const taskShard=`task:${taskId}`,previous=await g(env,`/task/${encodeURIComponent(taskId)}`,"GET",undefined,taskShard);if(previous.task)return error("DUPLICATE_TASK","task_id already exists",409,{task_id:taskId,status:previous.task.status});
  const localId=resolved.local_id||(LOCAL_MODELS[String(modelId).split(".").at(-1)]?String(modelId).split(".").at(-1):null);
  const recipe=localId?null:recipeFor(modelId);if(!localId&&!recipe)return error("MODEL_RECIPE_NOT_IMPLEMENTED","Model is registered but does not yet have a bounded executable recipe",501,{model_id:modelId,execution:"cataloged-specialist",arbitrary_code:false});
  if(recipe&&!env.KAGGLE_API_TOKEN)return error("UPSTREAM_AUTH_FAILED","KAGGLE_API_TOKEN is not configured",503,{model_id:modelId});
  const lock=await g(env,"/acquire","POST",{task_id:taskId,kind:localId?"compute-model-local":"compute-model-recipe",lease_seconds:timeout});if(!lock.ok)return error("BUSY","Another compute task is active",409,lock.active);
  try{
    if(localId){
      await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"accepted",kind:"local-model",executor:"local-model",model_id:modelId,local_model_id:localId,created_at:now()},taskShard);
      const result=runLocalModel(localId,args),resultDigest=await digest(JSON.stringify(result));
      await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"completed",kind:"local-model",executor:"local-model",model_id:modelId,local_model_id:localId,result_digest:resultDigest,finished_at:now()},taskShard);
      await g(env,"/release","POST",{task_id:taskId});
      return json({ok:true,task_id:taskId,status:"completed",executor:"local-model",model_id:modelId,local_model_id:localId,result,result_digest:resultDigest});
    }
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"accepted",kind:"model-recipe",executor:"kaggle-official",profile:"model",model_id:modelId,recipe:recipe.recipe,method:recipe.method,gpu:false,created_at:now()},taskShard);
    const out=await dispatch(env,{task_id:taskId,profile:"model",input:{model_recipe:{model_id:modelId,args}},timeout_seconds:timeout,gpu:false});
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"running",kind:"model-recipe",executor:"kaggle-official",profile:"model",model_id:modelId,recipe:recipe.recipe,method:recipe.method,user_name:out.user_name,kernel_slug:out.kernel_slug,ref:out.ref,version_number:out.version_number,gpu:false,machine_shape:out.machine_shape,started_at:now()},taskShard);
    return json({ok:true,task_id:taskId,status:"running",executor:"kaggle-official",model_id:modelId,recipe:recipe.recipe,machine_shape:out.machine_shape},202);
  }catch(e){
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"failed",model_id:modelId,error:String(e?.message||e),finished_at:now()},taskShard).catch(()=>{});await g(env,"/release","POST",{task_id:taskId}).catch(()=>{});
    return error(e?.message||"MODEL_EXECUTION_FAILED","Bounded model execution failed",e?.status||400,e?.details);
  }
}
export async function maybeHandleModels(req,env){const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/models")return json({ok:true,...registrySummary(),local:localModelMeta(),recipes:recipeMeta(),approved_recipe_models:EXECUTABLE_SPATIAL_IDS.map(id=>({id,...commercialSpatialExecutableModel(id)})),industries:industrySummary(),execution_policy:{local:"synchronous-bounded",kaggle_recipe:"async-fixed-template-no-internet",unimplemented:"fail-closed",arbitrary_code:false}});
  if(req.method==="GET"&&u.pathname==="/v1/models/package-stacks")return json({ok:true,package_stacks:PACKAGE_STACKS,runtime_state:"package-audit-gated",recipes:recipeMeta()});
  if(req.method==="GET"&&u.pathname==="/v1/models/local/meta")return json({ok:true,...localModelMeta()});
  if(req.method==="GET"&&u.pathname==="/v1/models/industries")return json({ok:true,...industrySummary(),workflows:STANDARD_WORKFLOWS});
  const im=u.pathname.match(/^\/v1\/models\/industry\/([a-z0-9_]+)$/);if(req.method==="GET"&&im){const p=industryPack(im[1]);return p?json({ok:true,...p}):error("INDUSTRY_PACK_NOT_FOUND","Unknown industry model pack",404,{allowed:Object.keys(INDUSTRY_PACKS)})}
  const m=u.pathname.match(/^\/v1\/models\/domain\/([a-z0-9_]+)$/);if(req.method==="GET"&&m){const d=domainModels(m[1]);return d?json({ok:true,...d}):error("DOMAIN_NOT_FOUND","Unknown model domain",404,{allowed:Object.keys(MODEL_REGISTRY)})}
  if(req.method==="POST"&&u.pathname==="/v1/models/run")return run(req,env);
  return null;
}
