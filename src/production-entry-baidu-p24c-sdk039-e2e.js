import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260817p24c-sdk039";
const ACCEPTANCE_PATH="/__acceptance/baidu-v100-p24c-sdk039-20260817-0384d41bd74495a633af72ee3a0ba1b03b064a83776dea891af8d741368151fa";
const STATUS_PATH="/__diagnostic/baidu-v100-p24c-sdk039-result-20260817-16949c117c8ccea6136c971cd31e4333b603dd89372c1ceefd0be852a96a03f0";
const ACCEPTANCE_EXPIRES_AT=Date.parse("2026-08-17T01:10:00Z");
const DIAGNOSTIC_EXPIRES_AT=Date.parse("2026-08-17T02:30:00Z");
const RUNTIME="paddle2.4_py3.7";
const SDK_VERSION="0.3.9";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=540){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,runtime_candidate:t.runtime_candidate||RUNTIME,sdk_candidate:t.sdk_candidate||SDK_VERSION,device:"v100",gpus:1,payment:"coupon",baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,upstream_diagnostic:t.upstream_diagnostic||null,result_digest:t.result_digest||null,bridge_result_retrieved:t.bridge_result_retrieved===true,verification:t.verification||null,circleci_pipeline_id_present:Boolean(t.circleci_pipeline_id),finished_at:t.finished_at||null,one_shot:true,automatic_retry:false,production_promoted:false}:null}

async function start(env){
  const meta=baiduCircleCIMeta(env);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  const policyOk=meta.runtime_candidate===RUNTIME&&meta.runtime_production===null&&meta.runtime_candidate_state==="QUARANTINED"&&meta.sdk_candidate_control_plane_verified===true&&meta.sdk_upgrade_candidate===`aistudio-sdk==${SDK_VERSION}`&&meta.sdk_candidate_gpu_verified===false&&meta.candidate_retest_policy==="single-sdk039-p24-canary-allowed-after-control-plane-pass"&&meta.sdk_candidate_acceptance_task===TASK_ID;
  if(!policyOk)return json({ok:false,error:"BAIDU_P24C_ACCEPTANCE_POLICY_MISMATCH"},409);
  const current=(await load(env)).task;
  if(current)return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202);
  const lock=await acquire(env,540);
  if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    const manifest={task_id:TASK_ID,profile:"gpu",input:{matrix_size:256,rounds:1,seed:20260817},timeout_seconds:300};
    await save(env,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,acceptance_run:true,one_shot:true,automatic_retry:false,production_promoted:false,runtime_candidate:RUNTIME,sdk_candidate:SDK_VERSION,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket,candidate_sdk_acceptance:true});
    if(out.sdk_version!==SDK_VERSION||out.candidate_sdk_acceptance!==true)throw new Error("SDK039_ACCEPTANCE_DISPATCH_MISMATCH");
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",runtime:RUNTIME,sdk_version:SDK_VERSION,device:"v100",gpus:1,payment:"coupon",one_shot:true,automatic_retry:false,production_promoted:false},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:String(e?.message||"CIRCLECI_DISPATCH_FAILED").slice(0,80),finished_at:now(),bridge_ticket_digest:null,production_promoted:false});
    await release(env).catch(()=>{});
    return json({ok:false,error:String(e?.message||"CIRCLECI_DISPATCH_FAILED").slice(0,200)},502);
  }
}

async function acceptance(req,env){
  const u=new URL(req.url);
  if(u.pathname===STATUS_PATH){
    if(Date.now()>DIAGNOSTIC_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true},410);
    if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const current=(await load(env)).task;
    if(!current)return json({ok:false,error:"TASK_NOT_FOUND",diagnostic:true,task_id:TASK_ID},404);
    const terminal=["completed","failed","cancelled"].includes(String(current.status||""));
    return json({ok:current.status==="completed",diagnostic:true,runtime:RUNTIME,sdk_version:SDK_VERSION,one_shot:true,task:safeTask(current)},terminal?200:202);
  }
  if(u.pathname!==ACCEPTANCE_PATH)return null;
  if(Date.now()>ACCEPTANCE_EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  return start(env);
}

export {ACCEPTANCE_PATH,STATUS_PATH};
export default {async fetch(req,env,ctx){const a=await acceptance(req,env);if(a)return a;return base.fetch(req,env,ctx)}};
