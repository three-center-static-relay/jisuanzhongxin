import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,normalizeBaiduInput,triggerBaiduBridge} from "./baidu-circleci.js";

const MANUAL_ACCEPTANCE_TOKEN_SHA256="6e722f77384096f5101619fa99c9523f7d790caaabba9c37b60024845ec062b8";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();

function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env,id){return g(env,`/task/${encodeURIComponent(id)}`)}
async function save(env,id,p){return g(env,`/task/${encodeURIComponent(id)}`,"POST",p)}
async function acquire(env,id,ttl){return g(env,"/acquire","POST",{task_id:id,kind:"compute",lease_seconds:ttl})}
async function release(env,id){return g(env,"/release","POST",{task_id:id})}
async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function authorized(req){const token=String(req.headers.get("x-three-center-acceptance-token")||"").trim();return Boolean(token)&&await sha256(token)===MANUAL_ACCEPTANCE_TOKEN_SHA256}

async function start(req,env){
  if(!await authorized(req))return json({ok:false,error:"UNAUTHORIZED",secret_echo:false},401);
  const meta=baiduCircleCIMeta(env);
  if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED",route_eligible:false,secret_echo:false},503);
  const b=await req.json().catch(()=>({})),id=String(b.task_id||`baidu-manual-${Date.now()}`);
  if(!/^[A-Za-z0-9._:-]{1,96}$/.test(id))return json({ok:false,error:"INVALID_TASK_ID"},400);
  const old=await load(env,id);if(old.task)return json({ok:false,error:"DUPLICATE_TASK",task_id:id,status:old.task.status},409);
  const timeout=300,lock=await acquire(env,id,timeout+240);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket),expires=Date.now()+900000;
    const manifest={task_id:id,profile:"gpu",input:normalizeBaiduInput({matrix_size:256,rounds:1,seed:20260819}),timeout_seconds:timeout};
    await save(env,id,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:expires,bridge_stage:"manual_acceptance_dispatching",manual_acceptance:true,payment:"coupon",acoin_allowed:false,paid_fallback:false,sdk_version:"0.3.9"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:id,bridge_ticket:ticket,sdk_version:"0.3.9"});
    await save(env,id,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now(),sdk_version:out.sdk_version});
    return json({ok:true,task_id:id,status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,sdk_version:out.sdk_version,payment:"coupon",acoin_allowed:false,paid_fallback:false,production_routing:false,route_eligible:false,secret_echo:false},202);
  }catch(e){await save(env,id,{status:"failed",error:String(e?.message||e).slice(0,240),failure_class:"CIRCLECI_DISPATCH_FAILED",bridge_ticket_digest:null,finished_at:now()}).catch(()=>{});await release(env,id).catch(()=>{});return json({ok:false,error:String(e?.message||"BAIDU_MANUAL_ACCEPTANCE_DISPATCH_FAILED").slice(0,120),task_id:id,route_eligible:false,secret_echo:false},503)}
}

async function status(req,env,u){
  if(!await authorized(req))return json({ok:false,error:"UNAUTHORIZED",secret_echo:false},401);
  const id=String(u.searchParams.get("task_id")||"");if(!id)return json({ok:false,error:"TASK_ID_REQUIRED"},400);
  const t=(await load(env,id)).task;if(!t)return json({ok:false,error:"TASK_NOT_FOUND",task_id:id},404);
  return json({ok:t.status!=="failed",task_id:id,status:t.status,bridge_stage:t.bridge_stage||null,circleci_pipeline_id:t.circleci_pipeline_id||null,baidu_job_id_present:Boolean(t.baidu_job_id),result_digest:t.result_digest||null,verification:t.verification||null,failure_class:t.failure_class||null,upstream_diagnostic:t.upstream_diagnostic||null,sdk_version:t.sdk_version||"0.3.9",payment:"coupon",acoin_allowed:false,paid_fallback:false,production_routing:false,route_eligible:false,finished_at:t.finished_at||null,secret_echo:false},t.status==="failed"?503:200);
}

async function cancel(req,env){
  if(!await authorized(req))return json({ok:false,error:"UNAUTHORIZED",secret_echo:false},401);
  const b=await req.json().catch(()=>({})),id=String(b.task_id||"");if(!id)return json({ok:false,error:"TASK_ID_REQUIRED"},400);
  const t=(await load(env,id)).task;if(!t)return json({ok:false,error:"TASK_NOT_FOUND",task_id:id},404);
  await save(env,id,{cancel_requested:true,cancel_requested_at:now(),status:"cancel_requested"});
  return json({ok:true,task_id:id,status:"cancel_requested",paid_fallback:false,secret_echo:false},202);
}

export async function maybeHandleBaiduManualAcceptance(req,env){
  const u=new URL(req.url);
  if(req.method==="POST"&&u.pathname==="/v1/selftest/baidu-runtime-manual")return start(req,env);
  if(req.method==="GET"&&u.pathname==="/v1/selftest/baidu-runtime-manual/status")return status(req,env,u);
  if(req.method==="POST"&&u.pathname==="/v1/selftest/baidu-runtime-manual/cancel")return cancel(req,env);
  return null;
}
