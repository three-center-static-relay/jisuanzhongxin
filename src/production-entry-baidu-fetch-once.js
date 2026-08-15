import base,{CenterGate} from "./production-entry.js";
import {digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260815d";
const PATH="/__acceptance/baidu-existing-v100-20260815d";
const CHECK_PATH=PATH+"/check";
const EXPIRES_AT=Date.parse("2026-08-16T00:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:180})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification?.ok===true,result_digest_present:/^[a-f0-9]{64}$/i.test(String(t.result_digest||"")),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null,finished_at:t.finished_at||null}:null}

async function dispatchExisting(env,op){
  const current=(await load(env)).task;
  if(!current)return json({ok:false,error:"TASK_NOT_FOUND"},404);
  if(current.status==="completed")return json({ok:true,already_completed:true,task:safeTask(current)});
  const job=String(current.baidu_job_id||"").trim();if(!job)return json({ok:false,error:"BAIDU_JOB_ID_MISSING"},409);
  const lock=await acquire(env);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    await save(env,{status:op==="CHECK"?"bridge_checking":"bridge_fetching",bridge_stage:"result_polling",failure_class:null,error:null,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+600000,[op==="CHECK"?"check_retry_at":"fetch_retry_at"]:now()});
    const out=await triggerBaiduBridge(env,{op,task_id:TASK_ID,baidu_job_id:job,bridge_ticket:ticket});
    await save(env,{circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:op==="CHECK"?"bridge_checking":"bridge_fetching",circleci_pipeline_id:out.pipeline_id},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:`CIRCLECI_${op}_DISPATCH_FAILED`,error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});
    await release(env).catch(()=>{});
    return json({ok:false,error:String(e?.message||`${op}_DISPATCH_FAILED`).slice(0,200)},502);
  }
}

async function acceptance(req,env){
  const u=new URL(req.url);if(u.pathname!==PATH&&u.pathname!==CHECK_PATH)return null;
  if(Date.now()>EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  if(req.method==="GET")return json({ok:true,task:safeTask((await load(env)).task)});
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  return dispatchExisting(env,u.pathname===CHECK_PATH?"CHECK":"FETCH");
}

export default {async fetch(req,env,ctx){const a=await acceptance(req,env);if(a)return a;return base.fetch(req,env,ctx)}};
