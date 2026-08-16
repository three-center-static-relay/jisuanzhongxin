import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,normalizeBaiduInput,triggerBaiduBridge} from "./baidu-circleci.js";

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const err=(c,m,s=400,d)=>json({ok:false,error:c,message:m,...(d?{details:d}:{})},s);
const terminal=s=>["completed","failed","cancelled"].includes(String(s||""));
const now=()=>new Date().toISOString();
const int=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d};
const SAFE_STAGES=new Set(["circleci_started","aistudio_authenticated","aistudio_submit_returned","baidu_submitted","result_polling","result_retrieved","baidu_terminal_failed"]);

function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env,id){return g(env,`/task/${encodeURIComponent(id)}`)}
async function save(env,id,p){return g(env,`/task/${encodeURIComponent(id)}`,"POST",p)}
async function acquire(env,id,ttl){return g(env,"/acquire","POST",{task_id:id,kind:"compute",lease_seconds:ttl})}
async function release(env,id){return g(env,"/release","POST",{task_id:id})}
async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function body(req){const text=await req.text();if(new TextEncoder().encode(text).length>65536)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});try{return text?JSON.parse(text):{}}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
function accepted(env){const m=baiduCircleCIMeta(env);return m.configured&&m.e2e_verified}
function validResult(task,r){
  if(!r||r.ok!==true||String(r.task_id)!==String(task.task_id)||String(r.profile)!==String(task.profile))return{ok:false,reason:"RESULT_IDENTITY_MISMATCH"};
  if(r.accelerator!=="v100"||r.cuda!==true||r.paddle_cuda!==true)return{ok:false,reason:"V100_VERIFICATION_FAILED"};
  if(!/v100/i.test(String(r.gpu_name||""))||!/gpu/i.test(String(r.device||"")))return{ok:false,reason:"V100_RUNTIME_ATTESTATION_FAILED"};
  if(!/^[a-f0-9]{64}$/i.test(String(r.matrix_checksum||"")))return{ok:false,reason:"RESULT_CHECKSUM_INVALID"};
  return{ok:true,v100_visible:true,paddle_cuda:true,gpu_name:String(r.gpu_name),device:String(r.device)}
}
function safeStage(v){const s=String(v||"").trim();return SAFE_STAGES.has(s)?s:null}
function safeFailureClass(v,error=""){
  const raw=String(v||"").trim().toUpperCase();
  if(/^[A-Z0-9_]{3,80}$/.test(raw))return raw;
  const e=String(error||"").toUpperCase();
  const known=["AISTUDIO_AUTH_CLI_NOT_FOUND","AISTUDIO_AUTH_CLI_TIMEOUT","AISTUDIO_AUTH_CLI_FAILED","AISTUDIO_SUBMIT_CLI_NOT_FOUND","AISTUDIO_SUBMIT_CLI_TIMEOUT","AISTUDIO_SUBMIT_CLI_FAILED","BAIDU_JOB_ID_NOT_FOUND","BAIDU_RESULT_TIMEOUT","CALLBACK_HTTP","MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN","MISSING_COMPUTE_CALLBACK_URL","MISSING_BRIDGE_TICKET"];
  return known.find(x=>e.startsWith(x))||"BAIDU_BRIDGE_FAILED";
}
async function ticketAuthorized(req,task){
  const ticket=String(req.headers.get("x-three-center-bridge-ticket")||"").trim();
  if(!ticket||!task?.bridge_ticket_digest||Number(task.bridge_ticket_expires_at_ms||0)<Date.now())return false;
  const actual=await digestBridgeTicket(ticket),expected=String(task.bridge_ticket_digest);
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
  return diff===0;
}

async function start(req,env){
  if(new URL(req.url).hostname!=="compute.internal")return err("POLICY_DENIED","Baidu execution is service-binding internal only",403);
  if(!accepted(env))return err("BAIDU_BRIDGE_NOT_ACCEPTED","CircleCI Baidu bridge is not configured and live-E2E verified",503,{bridge:baiduCircleCIMeta(env)});
  const b=await body(req),id=String(b.task_id||b.request_id||crypto.randomUUID()),profile=String(b.profile||"gpu");
  if(profile!=="gpu")return err("INVALID_REQUEST","Baidu bridge currently accepts only the bounded gpu profile",400,{allowed:["gpu"]});
  if(!/^[A-Za-z0-9._:-]{1,96}$/.test(id))return err("INVALID_REQUEST","task_id format invalid",400);
  const old=await load(env,id);if(old.task)return err("DUPLICATE_TASK","task_id already exists",409,{task_id:id,status:old.task.status});
  const timeout=Math.max(60,Math.min(900,int(b.timeout_seconds,300))),lock=await acquire(env,id,timeout+240);if(!lock.ok)return err("BUSY","Another compute task is active",409,lock.active);
  try{
    const ticket=newBridgeTicket(),ticketDigest=await digestBridgeTicket(ticket),ticketExpiresAt=Date.now()+Math.min(1800,(timeout+300))*1000;
    const manifest={task_id:id,profile,input:normalizeBaiduInput(b.input||{}),timeout_seconds:timeout};
    await save(env,id,{status:"bridge_dispatching",profile,executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,bridge_ticket_digest:ticketDigest,bridge_ticket_expires_at_ms:ticketExpiresAt,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:id,bridge_ticket:ticket});
    await save(env,id,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:id,status:"bridge_submitted",executor:"baidu-circleci-cli",circleci_pipeline_id:out.pipeline_id},202);
  }catch(e){await save(env,id,{status:"failed",error:String(e?.message||e),failure_class:"CIRCLECI_DISPATCH_FAILED",bridge_ticket_digest:null,finished_at:now()});await release(env,id);return err(e?.message||"BAIDU_BRIDGE_DISPATCH_FAILED","CircleCI bridge dispatch failed",e?.status||502,{task_id:id})}
}

async function manifest(req,env,id){
  const t=(await load(env,id)).task;if(!t||t.executor!=="baidu-circleci-cli")return err("TASK_NOT_FOUND","Task not found",404);
  if(!await ticketAuthorized(req,t))return err("UNAUTHORIZED","Bridge ticket invalid or expired",401);
  return json({ok:true,...t.manifest});
}
async function control(req,env,id){
  const t=(await load(env,id)).task;if(!t||t.executor!=="baidu-circleci-cli")return err("TASK_NOT_FOUND","Task not found",404);
  if(!await ticketAuthorized(req,t))return err("UNAUTHORIZED","Bridge ticket invalid or expired",401);
  return json({ok:true,task_id:id,cancel_requested:t.cancel_requested===true,timeout_seconds:t.manifest?.timeout_seconds||300,status:t.status});
}
async function callback(req,env){
  const b=await body(req),id=String(b.task_id||""),op=String(b.op||"").toUpperCase(),status=String(b.status||"").toLowerCase();
  if(!id||!["SUBMIT","CHECK","FETCH","CANCEL"].includes(op))return err("INVALID_REQUEST","Invalid bridge callback",400);
  const t=(await load(env,id)).task;if(!t||t.executor!=="baidu-circleci-cli")return err("TASK_NOT_FOUND","Task not found",404);
  if(!await ticketAuthorized(req,t))return err("UNAUTHORIZED","Bridge ticket invalid or expired",401);
  const job=String(b.baidu_job_id||t.baidu_job_id||""),stage=safeStage(b.stage),common={last_bridge_callback_at:now(),...(stage?{bridge_stage:stage}:{})};
  if(t.baidu_job_id&&job&&String(t.baidu_job_id)!==job)return err("JOB_ID_MISMATCH","Baidu job identity mismatch",409);
  if(status==="running"||status==="cancel_requested"){
    await save(env,id,{...common,status:status==="cancel_requested"?"cancel_requested":"running",baidu_job_id:job||t.baidu_job_id||null});
    return json({ok:true,task_id:id,status:status==="cancel_requested"?"cancel_requested":"running",bridge_stage:stage||t.bridge_stage||null});
  }
  if(status==="completed"){
    const verification=validResult(t,b.result);if(!verification.ok){await save(env,id,{...common,status:"failed",error:verification.reason,failure_class:verification.reason,verification,bridge_ticket_digest:null,finished_at:now()});await release(env,id);return err("UPSTREAM_TASK_FAILED",verification.reason,502,{task_id:id})}
    const digest=await sha256(JSON.stringify(b.result));await save(env,id,{...common,status:"completed",bridge_stage:stage||"result_retrieved",baidu_job_id:job||null,result:b.result,result_digest:digest,verification,finished_at:now(),bridge_result_retrieved:true,bridge_ticket_digest:null});await release(env,id);return json({ok:true,task_id:id,status:"completed",result_digest:digest,verification});
  }
  if(status==="cancelled"){
    await save(env,id,{...common,status:"cancelled",baidu_job_id:job||null,result_discarded:b.result_discarded===true,bridge_ticket_digest:null,finished_at:now()});await release(env,id);return json({ok:true,task_id:id,status:"cancelled"});
  }
  if(status==="failed"){
    const error=String(b.error||"BAIDU_BRIDGE_FAILED").slice(0,500),failure_class=safeFailureClass(b.failure_class,error);await save(env,id,{...common,status:"failed",baidu_job_id:job||null,error,failure_class,bridge_ticket_digest:null,finished_at:now()});await release(env,id);return json({ok:true,task_id:id,status:"failed",failure_class});
  }
  return err("INVALID_REQUEST","Unsupported callback status",400);
}
async function status(req,env){const b=await req.clone().json().catch(()=>({})),id=String(b.task_id||"");if(!id)return null;const t=(await load(env,id)).task;if(!t||t.executor!=="baidu-circleci-cli")return null;if(terminal(t.status))return json({ok:t.status!=="failed",task_id:id,status:t.status,result_digest:t.result_digest||null,verification:t.verification||null,failure_class:t.failure_class||null,bridge_stage:t.bridge_stage||null,finished_at:t.finished_at||null});return json({ok:true,task_id:id,status:t.status,bridge_stage:t.bridge_stage||null,baidu_job_id_present:Boolean(t.baidu_job_id),circleci_pipeline_id:t.circleci_pipeline_id||null,cancel_requested:t.cancel_requested===true,lock_released:false},202)}
async function cancel(req,env){const b=await req.clone().json().catch(()=>({})),id=String(b.task_id||"");if(!id)return null;const t=(await load(env,id)).task;if(!t||t.executor!=="baidu-circleci-cli")return null;if(terminal(t.status))return json({ok:true,task_id:id,status:t.status});await save(env,id,{cancel_requested:true,cancel_requested_at:now(),status:"cancel_requested"});return json({ok:true,task_id:id,status:"cancel_requested",native_cancel:false,bounded_upstream_timeout_seconds:t.manifest?.timeout_seconds||300,lock_retained:true},202)}

export async function maybeHandleBaiduCircleCI(req,env){
  const u=new URL(req.url),m=u.pathname.match(/^\/v1\/providers\/baidu\/bridge\/(task|control)\/([^/]+)$/);
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/bridge/meta")return json({ok:true,...baiduCircleCIMeta(env)});
  if(m&&req.method==="GET")return m[1]==="task"?manifest(req,env,decodeURIComponent(m[2])):control(req,env,decodeURIComponent(m[2]));
  if(req.method==="POST"&&u.pathname==="/v1/providers/baidu/bridge/callback")return callback(req,env);
  if(req.method==="POST"&&u.pathname==="/v1/run"){const b=await req.clone().json().catch(()=>({}));if(["baidu","baidu-aistudio"].includes(String(b.provider||"").toLowerCase()))return start(req,env)}
  if(req.method==="POST"&&u.pathname==="/v1/providers/baidu/run")return start(req,env);
  if(req.method==="POST"&&u.pathname==="/v1/status")return status(req,env);
  if(req.method==="POST"&&u.pathname==="/v1/cancel")return cancel(req,env);
  return null;
}
