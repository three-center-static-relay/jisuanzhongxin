import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260816k";
const PATH="/__acceptance/baidu-v100-shell-k-20260816k-83f1c4";
const CHECK_PATH=PATH+"/check";
const RETRY_PATH=PATH+"/retry";
const CALLBACK_PATH="/v1/providers/baidu/bridge/callback";
const EXPIRES_AT=Date.parse("2026-08-16T16:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=540){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,shell_canary_executed:t.failure_class==="BAIDU_SHELL_CANARY_EXECUTED",bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null,finished_at:t.finished_at||null,circleci_pipeline_id:t.circleci_pipeline_id||null}:null}
async function ticketAuthorized(req,t){const ticket=String(req.headers.get("x-three-center-bridge-ticket")||"").trim();if(!ticket||!t?.bridge_ticket_digest||Number(t.bridge_ticket_expires_at_ms||0)<Date.now())return false;const actual=await digestBridgeTicket(ticket),expected=String(t.bridge_ticket_digest);if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);return diff===0}

async function diagnosticCallback(req,env){
  const u=new URL(req.url);if(req.method!=="POST"||u.pathname!==CALLBACK_PATH)return null;
  const b=await req.clone().json().catch(()=>null);const r=b?.result;
  if(!b||String(b.task_id||"")!==TASK_ID||String(b.status||"").toLowerCase()!=="completed"||r?.ok!==false||String(r?.failure_class||"")!=="BAIDU_SHELL_CANARY_EXECUTED")return null;
  const current=(await load(env)).task;if(!current)return null;if(!await ticketAuthorized(req,current))return json({ok:false,error:"UNAUTHORIZED"},401);
  if(String(r.task_id||"")!==TASK_ID||String(r.profile||"")!=="gpu")return json({ok:false,error:"RESULT_IDENTITY_MISMATCH"},409);
  const job=String(b.baidu_job_id||current.baidu_job_id||"");if(current.baidu_job_id&&job&&String(current.baidu_job_id)!==job)return json({ok:false,error:"JOB_ID_MISMATCH"},409);
  await save(env,{status:"failed",baidu_job_id:job||null,bridge_stage:"result_retrieved",error:"BAIDU_SHELL_CANARY_EXECUTED",failure_class:"BAIDU_SHELL_CANARY_EXECUTED",bridge_result_retrieved:true,bridge_ticket_digest:null,finished_at:now()});await release(env).catch(()=>{});
  return json({ok:true,task_id:TASK_ID,status:"diagnostic_completed",shell_canary_executed:true});
}

async function start(env){
  const meta=baiduCircleCIMeta(env);if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  const current=(await load(env)).task;if(current)return json({ok:true,already_started:true,task:safeTask(current)},202);
  const lock=await acquire(env,540);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);const manifest={task_id:TASK_ID,profile:"gpu",input:{diagnostic:"fixed-shell-startup-canary"},timeout_seconds:120};await save(env,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,acceptance_run:true,shell_canary:true,bridge_stage:"cloudflare_dispatching"});const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket});await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,device:"v100",gpus:1,payment:"coupon",diagnostic:"fixed-shell-startup-canary"},202)}catch(e){await save(env,{status:"failed",failure_class:"CIRCLECI_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});return json({ok:false,error:String(e?.message||"CIRCLECI_DISPATCH_FAILED").slice(0,200)},502)}
}

async function retry(env){
  const current=(await load(env)).task;if(!current)return json({ok:false,error:"TASK_NOT_FOUND"},404);
  if(current.baidu_job_id)return json({ok:false,error:"RETRY_DENIED_BAIDU_PIPELINE_EXISTS",task:safeTask(current)},409);
  if(!["bridge_submitted","failed"].includes(String(current.status||"")))return json({ok:false,error:"RETRY_DENIED_STATE",task:safeTask(current)},409);
  await release(env).catch(()=>{});const lock=await acquire(env,540);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);await save(env,{status:"bridge_retry_dispatching",executor:"baidu-circleci-cli",bridge_stage:"cloudflare_dispatching",failure_class:null,error:null,finished_at:null,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,retry_at:now(),callback_executor_fix:true});const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket});await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});return json({ok:true,task_id:TASK_ID,status:"bridge_retry_submitted",circleci_pipeline_id:out.pipeline_id,callback_executor_fix:true},202)}catch(e){await save(env,{status:"failed",failure_class:"CIRCLECI_RETRY_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});return json({ok:false,error:String(e?.message||"RETRY_DISPATCH_FAILED").slice(0,200)},502)}
}

async function check(env){const current=(await load(env)).task;if(!current)return json({ok:false,error:"TASK_NOT_FOUND"},404);const job=String(current.baidu_job_id||"").trim();if(!job)return json({ok:false,error:"BAIDU_PIPELINE_ID_MISSING",task:safeTask(current)},409);const lock=await acquire(env,180);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);try{const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);await save(env,{status:"bridge_checking",bridge_stage:"result_polling",failure_class:null,error:null,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+600000,check_retry_at:now()});const out=await triggerBaiduBridge(env,{op:"CHECK",task_id:TASK_ID,baidu_job_id:job,bridge_ticket:ticket});await save(env,{circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});return json({ok:true,task_id:TASK_ID,status:"bridge_checking",circleci_pipeline_id:out.pipeline_id},202)}catch(e){await save(env,{status:"failed",failure_class:"CIRCLECI_CHECK_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});return json({ok:false,error:String(e?.message||"CHECK_DISPATCH_FAILED").slice(0,200)},502)}}

async function acceptance(req,env){const u=new URL(req.url);if(![PATH,CHECK_PATH,RETRY_PATH].includes(u.pathname))return null;if(Date.now()>EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);if(req.method==="GET")return json({ok:true,bridge:baiduCircleCIMeta(env),task:safeTask((await load(env)).task)});if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);if(u.pathname===CHECK_PATH)return check(env);if(u.pathname===RETRY_PATH)return retry(env);return start(env)}

export default {async fetch(req,env,ctx){const d=await diagnosticCallback(req,env);if(d)return d;const a=await acceptance(req,env);if(a)return a;return base.fetch(req,env,ctx)}};
