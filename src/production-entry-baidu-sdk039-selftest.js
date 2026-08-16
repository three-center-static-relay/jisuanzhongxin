import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const CIRCLE_API="https://circleci.com/api/v2";
const TASK_ID="baidu-sdk039-control-plane-20260816a";
const SELFTEST_PATH="/__selftest/baidu-sdk039-control-20260816-8f74851bb92a45ec9bf62f15aa9bd42e";
const STATUS_PATH="/__diagnostic/baidu-sdk039-control-result-20260816-d61c6d7be1ca4f43806ac1a021c1d8e8";
const SELFTEST_EXPIRES_AT=Date.parse("2026-08-16T14:00:00Z");
const DIAGNOSTIC_EXPIRES_AT=Date.parse("2026-08-16T14:15:00Z");
const SDK_VERSION="0.3.9";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=600){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"diagnostic",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,sdk_candidate:t.sdk_candidate||SDK_VERSION,gpu:false,compute_credit_used:false,circleci_pipeline_id_present:Boolean(t.circleci_pipeline_id),circleci_workflow_status:t.circleci_workflow_status||null,sdk_selftest_passed:t.sdk_selftest_passed===true,finished_at:t.finished_at||null,production_promoted:false}:null}

async function circleState(env,pipelineId){
  const token=String(env.CIRCLECI_API_TOKEN||"").trim();
  if(!token||!pipelineId)return{ok:false,error:"CIRCLECI_STATUS_NOT_CONFIGURED"};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(`${CIRCLE_API}/pipeline/${encodeURIComponent(pipelineId)}/workflow`,{headers:{"Circle-Token":token,accept:"application/json"},signal:controller.signal});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)return{ok:false,error:`CIRCLECI_STATUS_HTTP_${r.status}`};
    const items=Array.isArray(body.items)?body.items:[];
    if(!items.length)return{ok:true,terminal:false,status:"pipeline_created"};
    const statuses=items.map(x=>String(x?.status||"").toLowerCase()).filter(Boolean);
    const failed=statuses.find(x=>["failed","error","canceled","cancelled","unauthorized","not_run"].includes(x));
    if(failed)return{ok:true,terminal:true,passed:false,status:failed};
    if(statuses.length&&statuses.every(x=>x==="success"))return{ok:true,terminal:true,passed:true,status:"success"};
    return{ok:true,terminal:false,status:statuses[0]||"running"};
  }catch(e){return{ok:false,error:e?.name==="AbortError"?"CIRCLECI_STATUS_TIMEOUT":"CIRCLECI_STATUS_FAILED"}}
  finally{clearTimeout(timer)}
}

async function refresh(env,current){
  if(!current?.circleci_pipeline_id)return current;
  if(["completed","failed","cancelled"].includes(String(current.status||"")))return current;
  const state=await circleState(env,current.circleci_pipeline_id);
  if(!state.ok){await save(env,{status:current.status||"bridge_submitted",circleci_status_error:state.error,last_checked_at:now()});return{...current,circleci_status_error:state.error}}
  if(!state.terminal){await save(env,{status:"running",circleci_workflow_status:state.status,last_checked_at:now()});return{...current,status:"running",circleci_workflow_status:state.status}}
  const finalStatus=state.passed?"completed":"failed";
  const patch={status:finalStatus,circleci_workflow_status:state.status,sdk_selftest_passed:state.passed===true,gpu:false,compute_credit_used:false,finished_at:now(),bridge_ticket_digest:null};
  await save(env,patch);await release(env).catch(()=>{});
  return{...current,...patch};
}

async function start(env){
  const meta=baiduCircleCIMeta(env);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  if(meta.sdk_upgrade_candidate!=="aistudio-sdk==0.3.9"||meta.sdk_candidate_gpu_submission!==false)return json({ok:false,error:"SDK_CANDIDATE_POLICY_MISMATCH"},409);
  let current=(await load(env)).task;
  if(current){current=await refresh(env,current);return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202)}
  const lock=await acquire(env,600);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    await save(env,{status:"bridge_dispatching",executor:"baidu-sdk-selftest",gpu:false,compute_credit_used:false,created_at:now(),one_shot:true,sdk_candidate:SDK_VERSION,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000});
    const out=await triggerBaiduBridge(env,{op:"SDK_SELFTEST",task_id:TASK_ID,bridge_ticket:ticket});
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,sdk_candidate:out.sdk_version||SDK_VERSION,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",sdk_version:SDK_VERSION,gpu:false,compute_credit_used:false,one_shot:true},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:"CIRCLECI_SDK_SELFTEST_DISPATCH_FAILED",error:String(e?.message||e).slice(0,240),gpu:false,compute_credit_used:false,finished_at:now(),bridge_ticket_digest:null});
    await release(env).catch(()=>{});
    return json({ok:false,error:"CIRCLECI_SDK_SELFTEST_DISPATCH_FAILED",gpu:false,compute_credit_used:false},502);
  }
}

async function handle(req,env){
  const u=new URL(req.url);
  if(u.pathname===STATUS_PATH){
    if(Date.now()>DIAGNOSTIC_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true},410);
    if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    let current=(await load(env)).task;if(!current)return json({ok:false,error:"TASK_NOT_FOUND",diagnostic:true,task_id:TASK_ID},404);
    current=await refresh(env,current);
    const terminal=["completed","failed","cancelled"].includes(String(current.status||""));
    return json({ok:current.status==="completed",diagnostic:true,one_shot:true,sdk_version:SDK_VERSION,gpu:false,compute_credit_used:false,task:safeTask(current)},terminal?200:202);
  }
  if(u.pathname!==SELFTEST_PATH)return null;
  if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"SDK selftest trigger is service-binding internal only"},403);
  if(Date.now()>SELFTEST_EXPIRES_AT)return json({ok:false,error:"SELFTEST_ROUTE_EXPIRED"},410);
  if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  return start(env);
}

export {SELFTEST_PATH,STATUS_PATH};
export default{async fetch(req,env,ctx){const r=await handle(req,env);if(r)return r;return base.fetch(req,env,ctx)}};
