import guard,{CenterGate} from "./guard.js";
import {probeOpenEO,openEOMeta} from "./openeo.js";
import {probeBaiduAIStudio,baiduAIStudioMeta} from "./baidu-aistudio.js";
import {startFixedBaiduSmoke,queryBaiduPipeline,getFixedBaiduResult,stopBaiduPipeline,baiduNativeMeta} from "./baidu-native.js";
import {probeEarthEngine,stressEarthEngine} from "./google-ee.js";
import {introspect as kaggleIntrospect,officialMeta as kaggleOfficialMeta} from "./kaggle-official.js";
export {CenterGate};

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const KAGGLE_ACCEPT_PATH="/__diag/kaggle-current-accept-20260815-7b4f29d1";
const KAGGLE_ACCEPT_EXPIRES=Date.parse("2026-08-15T06:20:00Z");
const KAGGLE_ACCEPT_TASKS={
  "live-current-cpu-20260815a":{profile:"core",gpu:false,timeout_seconds:420,input:{matrix_size:256,monte_carlo_samples:250000,seed:20260815}},
  "live-current-t4-20260815a":{profile:"gpu",gpu:true,timeout_seconds:720,input:{matrix_size:1024,rounds:2,seed:20260815}}
};
const BAIDU_ACCEPT_PATH="/__diag/baidu-native-accept-20260815-84d2f6c7";
const BAIDU_ACCEPT_EXPIRES=Date.parse("2026-08-15T07:30:00Z");
const BAIDU_ACCEPT_TASK="baidu-native-smoke-20260815a";
let openEOHealth={at:0,value:null};
let baiduHealth={at:0,value:null};
let googleEEHealth={at:0,value:null};
let kaggleHealth={at:0,value:null};

async function openEOProbe(env){const now=Date.now();if(openEOHealth.value&&now-openEOHealth.at<300000)return {...openEOHealth.value,cached_health:true};try{const p=await probeOpenEO(env,{federated:false});const value={ok:p.ok===true,provider:"copernicus-openeo",configured:p.configured===true,authenticated:p.authenticated===true,endpoint:p.endpoint||"core-cdse",account_visible:p.account_visible===true,budget_reported:p.budget_reported===true,api_version:p.api_version||"unknown",backend_id:p.backend_id||"",secret_echo:false};openEOHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"copernicus-openeo",configured:Boolean(env.CDSE_CLIENT_ID&&env.CDSE_CLIENT_SECRET),authenticated:false,error_class:String(e?.message||"OPENEO_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};openEOHealth={at:now,value};return value}}
async function baiduProbe(env){const now=Date.now();if(baiduHealth.value&&now-baiduHealth.at<300000)return {...baiduHealth.value,cached_health:true};const value=await probeBaiduAIStudio(env);baiduHealth={at:now,value};return value}
async function googleEEProbe(env){const now=Date.now();if(googleEEHealth.value&&now-googleEEHealth.at<300000)return {...googleEEHealth.value,cached_health:true};try{const p=await probeEarthEngine(env,{compute:false});const value={ok:p.ok===true,provider:"google-earth-engine",configured:p.configured===true,oauth:p.oauth===true,registration_state:p.registration_state||"UNKNOWN",project_source:p.project_source||null,secret_echo:false};googleEEHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"google-earth-engine",configured:Boolean(env.GOOGLE_EE_SERVICE_ACCOUNT_JSON),oauth:false,error_class:String(e?.message||"GOOGLE_EE_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};googleEEHealth={at:now,value};return value}}
async function kaggleProbe(env){const now=Date.now();if(kaggleHealth.value&&now-kaggleHealth.at<300000)return {...kaggleHealth.value,cached_health:true};try{const who=await kaggleIntrospect(env),value={ok:who.active===true,provider:"kaggle",configured:Boolean(env.KAGGLE_API_TOKEN),authenticated:who.active===true,username_resolved:Boolean(who.username),business_e2e:false,secret_echo:false};kaggleHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"kaggle",configured:Boolean(env.KAGGLE_API_TOKEN),authenticated:false,business_e2e:false,error_class:String(e?.message||"KAGGLE_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};kaggleHealth={at:now,value};return value}}
async function googleEESelftest(env){try{const tiny=await probeEarthEngine(env,{compute:true}),stress=await stressEarthEngine(env),ok=tiny.ok===true&&tiny.compute_ok===true&&stress.ok===true;return{status:ok?200:503,body:{ok,provider:"google-earth-engine",business_e2e:true,tiny_compute_ok:tiny.compute_ok===true,parallel_requests:stress.parallel_requests,parallel_all_correct:stress.parallel_all_correct===true,parallel_http_statuses:stress.parallel_http_statuses,geospatial_graph_ok:stress.geospatial_graph_ok===true,negative_request_rejected:stress.negative_request_rejected===true,negative_http_status:stress.negative_http_status,elapsed_ms:stress.elapsed_ms,secret_echo:false}}}catch(e){return{status:503,body:{ok:false,provider:"google-earth-engine",business_e2e:true,error_class:String(e?.message||"GOOGLE_EE_SELFTEST_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false}}}}
async function kaggleAccept(req,env,ctx){
  if(Date.now()>KAGGLE_ACCEPT_EXPIRES)return json({ok:false,error:"DIAG_EXPIRED"},410);
  const b=await req.json().catch(()=>({})),taskId=String(b.task_id||""),action=String(b.action||""),spec=KAGGLE_ACCEPT_TASKS[taskId];
  if(!spec)return json({ok:false,error:"INVALID_TASK_ID"},400);
  if(action==="start"){
    const r=await guard.fetch(new Request("https://compute.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId,...spec})}),env,ctx);
    const out=await r.json().catch(()=>null);
    return json({ok:r.status===202,status_code:r.status,task_id:taskId,status:out?.status||null,error:out?.error||null,message:out?.message?String(out.message).slice(0,240):null,machine_shape:out?.machine_shape||null,secret_echo:false},200);
  }
  if(action==="status"){
    const r=await guard.fetch(new Request("https://compute.internal/v1/status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId})}),env,ctx);
    const out=await r.json().catch(()=>null);
    return json({status_code:r.status,body:out,secret_echo:false},200);
  }
  return json({ok:false,error:"INVALID_ACTION"},400);
}
function baiduAcceptGate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("baidu-native-accept-20260815"))}
async function baiduGateCall(env,path,method="GET",body){const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);const r=await baiduAcceptGate(env).fetch(new Request(`https://gate.internal${path}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function baiduAccept(req,env){
  if(Date.now()>BAIDU_ACCEPT_EXPIRES)return json({ok:false,error:"DIAG_EXPIRED"},410);
  const b=await req.json().catch(()=>({})),action=String(b.action||""),taskId=String(b.task_id||"");
  if(taskId!==BAIDU_ACCEPT_TASK)return json({ok:false,error:"INVALID_TASK_ID"},400);
  try{
    if(action==="start"){
      const prior=await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`);if(prior?.task)return json({ok:true,existing:true,task_id:taskId,pipeline_id:prior.task.pipeline_id||null,pipeline_name:prior.task.pipeline_name||null,status:prior.task.status||null,secret_echo:false},200);
      const lock=await baiduGateCall(env,"/acquire","POST",{task_id:taskId,kind:"baidu-native-accept",lease_seconds:7200});if(!lock.ok)return json({ok:false,error:"BUSY"},409);
      await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"starting",started_at:new Date().toISOString()});
      try{const out=await startFixedBaiduSmoke(env,taskId);await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"submitted",pipeline_id:out.pipeline_id,pipeline_name:out.pipeline_name,stage:out.stage,submitted_at:new Date().toISOString()});return json(out,200)}catch(e){await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"failed",error_class:String(e?.message||"BAIDU_NATIVE_START_FAILED").slice(0,240),finished_at:new Date().toISOString()});await baiduGateCall(env,"/release","POST",{task_id:taskId});throw e}
    }
    const stored=(await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`))?.task;if(!stored?.pipeline_id)return json({ok:false,error:"NOT_STARTED"},409);
    if(action==="status"){const out=await queryBaiduPipeline(env,stored.pipeline_id,stored.pipeline_name);await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"submitted",stage:out.stage,last_polled_at:new Date().toISOString()});return json({...out,task_id:taskId,secret_echo:false},200)}
    if(action==="result"){const out=await getFixedBaiduResult(env,stored.pipeline_id),r=out.result,verified=r?.ok===true&&r?.task_id===taskId&&r?.provider==="baidu-aistudio"&&r?.accelerator==="v100"&&r?.cuda===true&&/^gpu/i.test(String(r?.device||""));if(!verified)return json({ok:false,error:"BAIDU_RESULT_VERIFICATION_FAILED",task_id:taskId,secret_echo:false},502);await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"completed",verified:true,finished_at:new Date().toISOString()});await baiduGateCall(env,"/release","POST",{task_id:taskId});return json({ok:true,provider:"baidu-aistudio",task_id:taskId,pipeline_id:stored.pipeline_id,verified:true,accelerator:r.accelerator,cuda:true,device:String(r.device||""),shape:r.shape||null,checksum_present:Boolean(r.checksum),secret_echo:false},200)}
    if(action==="stop"){const out=await stopBaiduPipeline(env,stored.pipeline_id);await baiduGateCall(env,`/task/${encodeURIComponent(taskId)}`,"POST",{status:"stopped",finished_at:new Date().toISOString()});await baiduGateCall(env,"/release","POST",{task_id:taskId});return json({...out,task_id:taskId,secret_echo:false},200)}
    return json({ok:false,error:"INVALID_ACTION"},400);
  }catch(e){return json({ok:false,error_class:String(e?.message||"BAIDU_NATIVE_ACCEPT_FAILED").slice(0,240),http_status:Number(e?.status||0)||null,task_id:taskId,secret_echo:false},503)}
}

export default {async fetch(req,env,ctx){const u=new URL(req.url);
  if(req.method==="POST"&&u.pathname===KAGGLE_ACCEPT_PATH)return kaggleAccept(req,env,ctx);
  if(req.method==="POST"&&u.pathname===BAIDU_ACCEPT_PATH)return baiduAccept(req,env);
  if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/meta")return json({ok:true,provider:"copernicus-openeo",...openEOMeta(),secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/health"){const p=await openEOProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/meta")return json({ok:true,...baiduAIStudioMeta(),native_candidate:baiduNativeMeta(),secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/health"){const p=await baiduProbe(env);return json(p,p.manual_ready?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/kaggle/meta")return json({ok:true,provider:"kaggle",...kaggleOfficialMeta(),business_e2e:false,secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/kaggle/health"){const p=await kaggleProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/meta")return json({ok:true,provider:"google-earth-engine",automation_mode:"service-account-rest",arbitrary_code:false,service_binding_selftest:true,secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/health"){const p=await googleEEProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="POST"&&u.pathname==="/v1/providers/google-ee/selftest"){if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"Google Earth Engine selftest is service-binding internal only"},403);const r=await googleEESelftest(env);return json(r.body,r.status)}
  return guard.fetch(req,env,ctx);
}};