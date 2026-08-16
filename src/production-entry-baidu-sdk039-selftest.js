import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const CIRCLE_API="https://circleci.com/api/v2";
const TASK_ID="baidu-sdk039-control-plane-20260816c";
const SELFTEST_PATH="/__selftest/baidu-sdk039-control-c-20260816-fc039ebe971058376f824578e5af307d61b75c13a0249023a856d324e7511fc9";
const DIRECT_TRIGGER_PATH="/__selftest/baidu-sdk039-direct-c-20260816-ade741fd3291c5e71c32c7b66fd055d80a3a56062bd954c47ca7e2c33e05062e";
const STATUS_PATH="/__diagnostic/baidu-sdk039-control-result-c-20260816-01285625c159573990bb9a1fed3d6dd84e6be7b8994f5b3ed51f5497b04fd476";
const CALLBACK_PATH="/__callback/baidu-sdk039-c-20260816-b6c4e1f2a7935d08472e61c9bd563e1094f7a2c81d6e35b9f0248a7c53d18e60";
const SELFTEST_EXPIRES_AT=Date.parse("2026-08-17T01:00:00Z");
const DIAGNOSTIC_EXPIRES_AT=Date.parse("2026-08-17T01:20:00Z");
const SDK_VERSION="0.3.9";
const RESULT_SCHEMA="baidu-sdk039-selftest-result-v1";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=180){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"diagnostic",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,sdk_candidate:t.sdk_candidate||SDK_VERSION,gpu:false,compute_credit_used:false,circleci_pipeline_id_present:Boolean(t.circleci_pipeline_id),circleci_workflow_status:t.circleci_workflow_status||null,sdk_selftest_passed:t.sdk_selftest_passed===true,terminal_callback_received:t.terminal_callback_received===true,failure_class:t.failure_class||null,finished_at:t.finished_at||null,production_promoted:false}:null}

async function ticketAuthorized(req,task){
  const ticket=String(req.headers.get("x-three-center-bridge-ticket")||"").trim();
  if(!ticket||!task?.bridge_ticket_digest||Number(task.bridge_ticket_expires_at_ms||0)<Date.now())return false;
  const actual=await digestBridgeTicket(ticket),expected=String(task.bridge_ticket_digest||"");
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}

async function circleState(env,pipelineId){
  const token=String(env.CIRCLECI_API_TOKEN||"").trim();
  if(!token||!pipelineId)return{ok:false,error:"CIRCLECI_STATUS_NOT_CONFIGURED"};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
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
  const patch={status:finalStatus,circleci_workflow_status:state.status,sdk_selftest_passed:state.passed===true&&current.terminal_callback_received===true,gpu:false,compute_credit_used:false,finished_at:now(),bridge_ticket_digest:null};
  await save(env,patch);await release(env).catch(()=>{});
  return{...current,...patch};
}

async function terminalCallback(req,env){
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const current=(await load(env)).task;
  if(!current||current.executor!=="baidu-sdk-selftest")return json({ok:false,error:"TASK_NOT_FOUND"},404);
  if(!await ticketAuthorized(req,current))return json({ok:false,error:"UNAUTHORIZED"},401);
  const text=await req.text();
  if(new TextEncoder().encode(text).length>8192)return json({ok:false,error:"BODY_TOO_LARGE"},413);
  let body={};try{body=text?JSON.parse(text):{}}catch{return json({ok:false,error:"INVALID_REQUEST"},400)}
  if(body.schema!==RESULT_SCHEMA||body.suite!=="baidu-sdk-0.3.9-control-plane-selftest"||body.sdk_version!==SDK_VERSION)return json({ok:false,error:"SDK_SELFTEST_RESULT_IDENTITY_MISMATCH"},409);
  if(body.gpu_submitted!==false||body.compute_credit_used!==false||body.secrets_emitted!==false)return json({ok:false,error:"SDK_SELFTEST_SAFETY_ATTESTATION_FAILED"},409);
  if(body.ok===true){
    const valid=body.cli_help===true&&body.job_help===true&&body.pipeline_query_ok===true&&body.output_access_callable===true&&Number.isInteger(body.pipeline_query_parameter_count)&&Number.isInteger(body.output_access_parameter_count);
    if(!valid)return json({ok:false,error:"SDK_SELFTEST_RESULT_INVALID"},409);
    await save(env,{status:"completed",sdk_selftest_passed:true,terminal_callback_received:true,sdk_result:{sdk_version:SDK_VERSION,cli_help:true,job_help:true,pipeline_query_ok:true,pipeline_query_result_is_list:body.pipeline_query_result_is_list===true,pipeline_query_parameter_count:body.pipeline_query_parameter_count,output_access_callable:true,output_access_parameter_count:body.output_access_parameter_count},gpu:false,compute_credit_used:false,failure_class:null,finished_at:now(),bridge_ticket_digest:null});
    await release(env).catch(()=>{});
    return json({ok:true,task_id:TASK_ID,status:"completed",sdk_selftest_passed:true,gpu:false,compute_credit_used:false});
  }
  const failure=String(body.failure_class||"AISTUDIO_SDK_SELFTEST_FAILED").trim().toUpperCase();
  if(!/^(AISTUDIO|MISSING|SDK_SELFTEST)_[A-Z0-9_]{2,76}$/.test(failure))return json({ok:false,error:"SDK_SELFTEST_FAILURE_CLASS_INVALID"},409);
  await save(env,{status:"failed",sdk_selftest_passed:false,terminal_callback_received:true,failure_class:failure,gpu:false,compute_credit_used:false,finished_at:now(),bridge_ticket_digest:null});
  await release(env).catch(()=>{});
  return json({ok:true,task_id:TASK_ID,status:"failed",failure_class:failure,gpu:false,compute_credit_used:false});
}

async function start(env){
  const meta=baiduCircleCIMeta(env);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  if(meta.sdk_upgrade_candidate!=="aistudio-sdk==0.3.9"||meta.sdk_candidate_gpu_submission!==false)return json({ok:false,error:"SDK_CANDIDATE_POLICY_MISMATCH"},409);
  let current=(await load(env)).task;
  if(current){current=await refresh(env,current);return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202)}
  const lock=await acquire(env,180);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    await save(env,{status:"bridge_dispatching",executor:"baidu-sdk-selftest",gpu:false,compute_credit_used:false,created_at:now(),one_shot:true,sdk_candidate:SDK_VERSION,terminal_callback_received:false,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+300000});
    const out=await triggerBaiduBridge(env,{op:"SDK_SELFTEST",task_id:TASK_ID,bridge_ticket:ticket});
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,sdk_candidate:out.sdk_version||SDK_VERSION,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",sdk_version:SDK_VERSION,gpu:false,compute_credit_used:false,one_shot:true},202);
  }catch(e){
    await save(env,{status:"failed",sdk_selftest_passed:false,terminal_callback_received:false,failure_class:"CIRCLECI_SDK_SELFTEST_DISPATCH_FAILED",gpu:false,compute_credit_used:false,finished_at:now(),bridge_ticket_digest:null});
    await release(env).catch(()=>{});
    return json({ok:false,error:"CIRCLECI_SDK_SELFTEST_DISPATCH_FAILED",gpu:false,compute_credit_used:false},502);
  }
}

async function handle(req,env){
  const u=new URL(req.url);
  if(u.pathname===CALLBACK_PATH)return terminalCallback(req,env);
  if(u.pathname===STATUS_PATH){
    if(Date.now()>DIAGNOSTIC_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true},410);
    if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    let current=(await load(env)).task;if(!current)return json({ok:false,error:"TASK_NOT_FOUND",diagnostic:true,task_id:TASK_ID},404);
    if(!["completed","failed","cancelled"].includes(String(current.status||"")))current=await refresh(env,current);
    const terminal=["completed","failed","cancelled"].includes(String(current.status||""));
    return json({ok:current.status==="completed",diagnostic:true,one_shot:true,sdk_version:SDK_VERSION,gpu:false,compute_credit_used:false,task:safeTask(current)},terminal?200:202);
  }
  if(u.pathname===DIRECT_TRIGGER_PATH){
    if(Date.now()>SELFTEST_EXPIRES_AT)return json({ok:false,error:"SELFTEST_ROUTE_EXPIRED"},410);
    if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    return start(env);
  }
  if(u.pathname!==SELFTEST_PATH)return null;
  if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"SDK selftest trigger is service-binding internal only"},403);
  if(Date.now()>SELFTEST_EXPIRES_AT)return json({ok:false,error:"SELFTEST_ROUTE_EXPIRED"},410);
  if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  return start(env);
}

export {SELFTEST_PATH,DIRECT_TRIGGER_PATH,STATUS_PATH,CALLBACK_PATH};
export default{async fetch(req,env,ctx){const r=await handle(req,env);if(r)return r;return base.fetch(req,env,ctx)}};
