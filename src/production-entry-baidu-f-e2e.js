import legacy,{CenterGate} from "./production-entry-baidu-e-with-d-diag.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,normalizeBaiduInput,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260815f";
const PATH="/__acceptance/baidu-v100-e2e-20260815f-91a7c3";
const CHECK_PATH=PATH+"/check";
const FETCH_PATH=PATH+"/fetch";
const EXPIRES_AT=Date.parse("2026-08-16T00:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=720){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification?.ok===true,result_digest_present:/^[a-f0-9]{64}$/i.test(String(t.result_digest||"")),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null,finished_at:t.finished_at||null,circleci_pipeline_id:t.circleci_pipeline_id||null}:null}

async function start(env){
  const meta=baiduCircleCIMeta(env);if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  const current=(await load(env)).task;if(current)return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:202);
  const lock=await acquire(env,720);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const timeout=300,ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    const manifest={task_id:TASK_ID,profile:"gpu",input:normalizeBaiduInput({matrix_size:512,rounds:1,seed:20260815}),timeout_seconds:timeout};
    await save(env,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,acceptance_run:true,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket});
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,device:"v100",gpus:1,payment:"coupon",submit_confirmation:"baidu-query-required"},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:"CIRCLECI_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});
    return json({ok:false,error:String(e?.message||"CIRCLECI_DISPATCH_FAILED").slice(0,200)},502);
  }
}

async function dispatchExisting(env,op){
  const current=(await load(env)).task;if(!current)return json({ok:false,error:"TASK_NOT_FOUND"},404);
  if(current.status==="completed")return json({ok:true,already_completed:true,task:safeTask(current)});
  const job=String(current.baidu_job_id||"").trim();if(!job)return json({ok:false,error:"BAIDU_PIPELINE_ID_MISSING",task:safeTask(current)},409);
  const lock=await acquire(env,180);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    await save(env,{status:op==="CHECK"?"bridge_checking":"bridge_fetching",bridge_stage:"result_polling",failure_class:null,error:null,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+600000,[op==="CHECK"?"check_retry_at":"fetch_retry_at"]:now()});
    const out=await triggerBaiduBridge(env,{op,task_id:TASK_ID,baidu_job_id:job,bridge_ticket:ticket});
    await save(env,{circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:op==="CHECK"?"bridge_checking":"bridge_fetching",circleci_pipeline_id:out.pipeline_id},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:`CIRCLECI_${op}_DISPATCH_FAILED`,error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});
    return json({ok:false,error:String(e?.message||`${op}_DISPATCH_FAILED`).slice(0,200)},502);
  }
}

async function acceptance(req,env){
  const u=new URL(req.url);if(![PATH,CHECK_PATH,FETCH_PATH].includes(u.pathname))return null;
  if(Date.now()>EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  if(req.method==="GET")return json({ok:true,bridge:baiduCircleCIMeta(env),task:safeTask((await load(env)).task)});
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(u.pathname===CHECK_PATH)return dispatchExisting(env,"CHECK");
  if(u.pathname===FETCH_PATH)return dispatchExisting(env,"FETCH");
  return start(env);
}

export default {async fetch(req,env,ctx){const a=await acceptance(req,env);if(a)return a;return legacy.fetch(req,env,ctx)}};
