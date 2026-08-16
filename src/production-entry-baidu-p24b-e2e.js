import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260816p24b";
const ACCEPTANCE_PATH="/__acceptance/baidu-v100-p24b-20260816-4bcb46c4f3d64a27a1b869243171e4aa";
const STATUS_PATH="/__diagnostic/baidu-v100-p24b-result-20260816-ae9f40a8b99d43d9a28df1fcbf2ab7f4";
const ACCEPTANCE_EXPIRES_AT=Date.parse("2026-08-16T12:30:00Z");
const DIAGNOSTIC_EXPIRES_AT=Date.parse("2026-08-16T13:30:00Z");
const RUNTIME="paddle2.4_py3.7";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=540){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,runtime_candidate:t.runtime_candidate||RUNTIME,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,upstream_diagnostic:t.upstream_diagnostic||null,result_digest:t.result_digest||null,bridge_result_retrieved:t.bridge_result_retrieved===true,verification:t.verification||null,circleci_pipeline_id_present:Boolean(t.circleci_pipeline_id),finished_at:t.finished_at||null,production_promoted:false}:null}

async function start(env){
  const meta=baiduCircleCIMeta(env);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  if(meta.runtime_candidate!==RUNTIME||meta.runtime_production!==null)return json({ok:false,error:"BAIDU_RUNTIME_ACCEPTANCE_STATE_INVALID",candidate:meta.runtime_candidate||null,production:meta.runtime_production||null},409);
  const current=(await load(env)).task;
  if(current)return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202);
  const lock=await acquire(env,540);
  if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    const manifest={task_id:TASK_ID,profile:"gpu",input:{matrix_size:256,rounds:1,seed:20260816},timeout_seconds:300};
    await save(env,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,acceptance_run:true,one_shot:true,runtime_candidate:RUNTIME,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket});
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",runtime:RUNTIME,device:"v100",gpus:1,payment:"coupon",one_shot:true,production_promoted:false},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:"CIRCLECI_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});
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
    return json({ok:current.status==="completed",diagnostic:true,one_shot:true,task:safeTask(current)},terminal?200:202);
  }
  if(u.pathname!==ACCEPTANCE_PATH)return null;
  if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"Baidu acceptance trigger is service-binding internal only"},403);
  if(Date.now()>ACCEPTANCE_EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const current=(await load(env)).task;
  if(current)return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202);
  return start(env);
}

export default {async fetch(req,env,ctx){const a=await acceptance(req,env);if(a)return a;return base.fetch(req,env,ctx)}};
