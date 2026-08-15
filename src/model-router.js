import {registrySummary,domainModels,MODEL_REGISTRY,PACKAGE_STACKS} from "./model-registry.js";
import {runLocalModel,localModelMeta} from "./local-models.js";
const MAX_BODY_BYTES=65536,DEFAULT_RATE=30;
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const error=(code,message,status=400,details)=>json({ok:false,error:code,message,...(details?{details}:{})},status);
const now=()=>new Date().toISOString();
const int=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d};
async function digest(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function parse(req){const n=Number(req.headers.get("content-length")||0);if(n>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});const t=await req.text();if(new TextEncoder().encode(t).length>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});try{return t?JSON.parse(t):{}}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,path,method="GET",body){const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);const r=await gate(env).fetch(new Request(`https://gate.internal${path}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function run(req,env){
  if(new URL(req.url).hostname!=="compute.internal")return error("POLICY_DENIED","Model execution is service-binding internal only",403);
  const rate=await g(env,"/rate","POST",{limit:int(env.RATE_LIMIT_PER_MIN,DEFAULT_RATE)});if(!rate.ok)return error("RATE_LIMITED","Compute budget exceeded",429,rate);
  const b=await parse(req),modelId=String(b.model_id||""),taskId=String(b.task_id||crypto.randomUUID());if(!modelId)return error("INVALID_REQUEST","model_id required",400);
  const previous=await g(env,`/task/${encodeURIComponent(taskId)}`);if(previous.task)return error("DUPLICATE_TASK","task_id already exists",409,{task_id:taskId,status:previous.task.status});
  const lock=await g(env,"/acquire","POST",{task_id:taskId,kind:"compute-model",lease_seconds:300});if(!lock.ok)return error("BUSY","Another compute task is active",409,lock.active);
  try{
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"accepted",executor:"local-model",model_id:modelId,created_at:now()});
    const result=runLocalModel(modelId,b.input||b.args||{}),resultDigest=await digest(JSON.stringify(result));
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"completed",executor:"local-model",model_id:modelId,result_digest:resultDigest,finished_at:now()});
    await g(env,"/release","POST",{task_id:taskId});
    return json({ok:true,task_id:taskId,status:"completed",executor:"local-model",model_id:modelId,result,result_digest:resultDigest});
  }catch(e){
    await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"failed",executor:"local-model",model_id:modelId,error:String(e?.message||e),finished_at:now()}).catch(()=>{});await g(env,"/release","POST",{task_id:taskId}).catch(()=>{});
    return error(e?.message||"MODEL_EXECUTION_FAILED","Bounded model execution failed",e?.status||400,e?.details);
  }
}
export async function maybeHandleModels(req,env){const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/models")return json({ok:true,...registrySummary(),local:localModelMeta()});
  if(req.method==="GET"&&u.pathname==="/v1/models/package-stacks")return json({ok:true,package_stacks:PACKAGE_STACKS,runtime_state:"package-audit-required-for-kaggle-specialist-stacks"});
  if(req.method==="GET"&&u.pathname==="/v1/models/local/meta")return json({ok:true,...localModelMeta()});
  const m=u.pathname.match(/^\/v1\/models\/domain\/([a-z0-9_]+)$/);if(req.method==="GET"&&m){const d=domainModels(m[1]);return d?json({ok:true,...d}):error("DOMAIN_NOT_FOUND","Unknown model domain",404,{allowed:Object.keys(MODEL_REGISTRY)})}
  if(req.method==="POST"&&u.pathname==="/v1/models/run")return run(req,env);
  return null;
}
