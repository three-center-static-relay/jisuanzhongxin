import base,{CenterGate} from "./production-entry.js";
import {digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260815d";
const FETCH_PATH="/__diag/baidu-circleci-live-20260815-d7a21f/fetch";
const EXPIRES_AT_MS=Date.parse("2026-08-16T00:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:120})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}

async function fetchExisting(req,env){
  if(new URL(req.url).pathname!==FETCH_PATH)return null;
  if(Date.now()>EXPIRES_AT_MS)return json({ok:false,error:"FETCH_ROUTE_EXPIRED"},410);
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const current=(await load(env)).task;
  if(!current)return json({ok:false,error:"TASK_NOT_FOUND"},404);
  if(current.status==="completed")return json({ok:true,task_id:TASK_ID,status:"completed",already_completed:true},200);
  const job=String(current.baidu_job_id||"").trim();
  if(!job)return json({ok:false,error:"BAIDU_JOB_ID_MISSING"},409);
  const lock=await acquire(env);
  if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket),expires=Date.now()+600000;
    await save(env,{status:"bridge_fetching",bridge_stage:"result_polling",failure_class:null,error:null,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:expires,fetch_retry_at:now()});
    const out=await triggerBaiduBridge(env,{op:"FETCH",task_id:TASK_ID,baidu_job_id:job,bridge_ticket:ticket});
    await save(env,{circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_fetching",circleci_pipeline_id:out.pipeline_id},202);
  }catch(e){
    await save(env,{status:"failed",failure_class:"CIRCLECI_FETCH_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});
    await release(env).catch(()=>{});
    return json({ok:false,error:String(e?.message||"FETCH_DISPATCH_FAILED").slice(0,200)},502);
  }
}

export default {
  async fetch(req,env,ctx){
    const handled=await fetchExisting(req,env);
    if(handled)return handled;
    return base.fetch(req,env,ctx);
  }
};
