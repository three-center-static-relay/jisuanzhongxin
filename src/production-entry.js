import production,{CenterGate} from "./production.js";
import {maybeHandleBaiduCircleCI} from "./baidu-circleci-router.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,normalizeBaiduInput,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const DIAG_PATH="/__diag/baidu-circleci-live-20260815-c4f1a8";
const DIAG_TASK_ID="baidu-circleci-live-20260815c";
const DIAG_EXPIRES_AT_MS=Date.parse("2026-08-16T00:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env,id){return g(env,`/task/${encodeURIComponent(id)}`)}
async function save(env,id,p){return g(env,`/task/${encodeURIComponent(id)}`,"POST",p)}
async function acquire(env,id,ttl){return g(env,"/acquire","POST",{task_id:id,kind:"compute",lease_seconds:ttl})}
async function release(env,id){return g(env,"/release","POST",{task_id:id})}

async function liveAcceptance(req,env){
  const u=new URL(req.url);
  if(u.pathname!==DIAG_PATH)return null;
  if(Date.now()>DIAG_EXPIRES_AT_MS)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  const meta=baiduCircleCIMeta(env);
  if(req.method==="GET"){
    const t=(await load(env,DIAG_TASK_ID)).task;
    return json({ok:true,acceptance:"baidu-circleci-v100",configured:meta.configured,e2e_verified:meta.e2e_verified,task:t?{task_id:DIAG_TASK_ID,status:t.status||null,circleci_pipeline_id:t.circleci_pipeline_id||null,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification:t.verification||null,result_digest:t.result_digest||null,error:t.error||null,bridge_result_retrieved:t.bridge_result_retrieved===true,finished_at:t.finished_at||null}:null});
  }
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED",bridge:{configured:false}},503);
  const old=(await load(env,DIAG_TASK_ID)).task;
  if(old)return json({ok:true,task_id:DIAG_TASK_ID,status:old.status||"unknown",already_started:true,circleci_pipeline_id:old.circleci_pipeline_id||null,bridge_stage:old.bridge_stage||null,failure_class:old.failure_class||null},old.status==="completed"?200:202);
  const lock=await acquire(env,DIAG_TASK_ID,720);
  if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const timeout=300;
    const ticket=newBridgeTicket(),ticketDigest=await digestBridgeTicket(ticket),ticketExpiresAt=Date.now()+900000;
    const manifest={task_id:DIAG_TASK_ID,profile:"gpu",input:normalizeBaiduInput({matrix_size:512,rounds:1,seed:20260815}),timeout_seconds:timeout};
    await save(env,DIAG_TASK_ID,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,bridge_ticket_digest:ticketDigest,bridge_ticket_expires_at_ms:ticketExpiresAt,acceptance_run:true,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:DIAG_TASK_ID,bridge_ticket:ticket});
    await save(env,DIAG_TASK_ID,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:DIAG_TASK_ID,status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,acceptance:"baidu-circleci-v100"},202);
  }catch(e){
    await save(env,DIAG_TASK_ID,{status:"failed",error:String(e?.message||e).slice(0,300),failure_class:"CIRCLECI_DISPATCH_FAILED",bridge_ticket_digest:null,finished_at:now()});
    await release(env,DIAG_TASK_ID).catch(()=>{});
    return json({ok:false,error:String(e?.message||"BAIDU_CIRCLECI_ACCEPTANCE_FAILED").slice(0,200)},Number(e?.status||0)||502);
  }
}

export default {
  async fetch(req,env,ctx){
    const diag=await liveAcceptance(req,env);
    if(diag)return diag;
    const handled=await maybeHandleBaiduCircleCI(req,env);
    if(handled)return handled;
    return production.fetch(req,env,ctx);
  }
};
