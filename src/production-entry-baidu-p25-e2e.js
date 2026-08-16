import base,{CenterGate} from "./production-entry.js";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260816p25";
const PATH="/__acceptance/baidu-v100-p25-20260816-a91d7f3c2b6e4a58d04c8f1e7b9a3d62";
const CALLBACK_PATH="/v1/providers/baidu/bridge/callback";
const EXPIRES_AT=Date.parse("2026-08-16T10:00:00Z");
const RUNTIME="paddle2.5_py3.10";
const DIAGNOSTIC="paddle25-v100-e2e";
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const now=()=>new Date().toISOString();
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const init={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)init.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,init));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env){return g(env,`/task/${encodeURIComponent(TASK_ID)}`)}
async function save(env,p){return g(env,`/task/${encodeURIComponent(TASK_ID)}`,"POST",p)}
async function acquire(env,ttl=660){return g(env,"/acquire","POST",{task_id:TASK_ID,kind:"compute",lease_seconds:ttl})}
async function release(env){return g(env,"/release","POST",{task_id:TASK_ID})}
async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function safeTask(t){return t?{task_id:TASK_ID,status:t.status||null,executor:t.executor||null,runtime_candidate:t.runtime_candidate||RUNTIME,baidu_job_id_present:Boolean(t.baidu_job_id),bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,error:t.error||null,result_digest:t.result_digest||null,bridge_result_retrieved:t.bridge_result_retrieved===true,verification:t.verification||null,circleci_pipeline_id:t.circleci_pipeline_id||null,finished_at:t.finished_at||null}:null}
async function ticketAuthorized(req,t){const ticket=String(req.headers.get("x-three-center-bridge-ticket")||"").trim();if(!ticket||!t?.bridge_ticket_digest||Number(t.bridge_ticket_expires_at_ms||0)<Date.now())return false;const actual=await digestBridgeTicket(ticket),expected=String(t.bridge_ticket_digest);if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);return diff===0}
function verifyResult(r){
  if(!r||r.ok!==true)return{ok:false,reason:"P25_RESULT_NOT_OK"};
  if(String(r.task_id)!==TASK_ID||String(r.profile)!=="gpu")return{ok:false,reason:"P25_RESULT_IDENTITY_MISMATCH"};
  if(String(r.diagnostic)!==DIAGNOSTIC||String(r.runtime)!==RUNTIME)return{ok:false,reason:"P25_RUNTIME_IDENTITY_MISMATCH"};
  if(String(r.accelerator)!=="v100"||r.cuda!==true||r.paddle_cuda!==true)return{ok:false,reason:"P25_CUDA_VERIFICATION_FAILED"};
  if(!/v100/i.test(String(r.device||""))||!/gpu/i.test(String(r.paddle_device||"")))return{ok:false,reason:"P25_V100_DEVICE_VERIFICATION_FAILED"};
  if(Math.abs(Number(r.cuda_kernel_value)-14)>1e-6)return{ok:false,reason:"P25_CUDA_KERNEL_SANITY_FAILED"};
  if(!/^[a-f0-9]{64}$/i.test(String(r.matrix_checksum||"")))return{ok:false,reason:"P25_CHECKSUM_INVALID"};
  return{ok:true,runtime:RUNTIME,v100_visible:true,paddle_cuda:true,cuda_kernel_executed:true,result_file_retrieved:true};
}

async function diagnosticCallback(req,env){
  const u=new URL(req.url);if(req.method!=="POST"||u.pathname!==CALLBACK_PATH)return null;
  const b=await req.clone().json().catch(()=>null);if(!b||String(b.task_id||"")!==TASK_ID||String(b.status||"").toLowerCase()!=="completed")return null;
  const current=(await load(env)).task;if(!current)return null;if(!await ticketAuthorized(req,current))return json({ok:false,error:"UNAUTHORIZED"},401);
  const job=String(b.baidu_job_id||current.baidu_job_id||"");if(current.baidu_job_id&&job&&String(current.baidu_job_id)!==job)return json({ok:false,error:"JOB_ID_MISMATCH"},409);
  const verification=verifyResult(b.result);
  if(!verification.ok){await save(env,{status:"failed",baidu_job_id:job||null,bridge_stage:"result_retrieved",failure_class:verification.reason,error:verification.reason,verification,bridge_result_retrieved:true,bridge_ticket_digest:null,finished_at:now()});await release(env).catch(()=>{});return json({ok:false,error:verification.reason,verification},502)}
  const digest=await sha256(JSON.stringify(b.result));
  await save(env,{status:"completed",baidu_job_id:job||null,bridge_stage:"result_retrieved",runtime_candidate:RUNTIME,result_digest:digest,verification,bridge_result_retrieved:true,bridge_ticket_digest:null,finished_at:now()});await release(env).catch(()=>{});
  return json({ok:true,task_id:TASK_ID,status:"completed",runtime:RUNTIME,result_digest:digest,verification});
}

async function start(env){
  const meta=baiduCircleCIMeta(env);if(!meta.configured)return json({ok:false,error:"BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"},503);
  const current=(await load(env)).task;if(current)return json({ok:true,already_started:true,task:safeTask(current)},current.status==="completed"?200:202);
  const lock=await acquire(env,660);if(!lock.ok)return json({ok:false,error:"BUSY",active:lock.active||null},409);
  try{
    const ticket=newBridgeTicket(),digest=await digestBridgeTicket(ticket);
    const manifest={task_id:TASK_ID,profile:"gpu",input:{diagnostic:DIAGNOSTIC,runtime:RUNTIME},timeout_seconds:300};
    await save(env,{status:"bridge_dispatching",profile:"gpu",executor:"baidu-circleci-cli",gpu:true,manifest,created_at:now(),cancel_requested:false,acceptance_run:true,one_shot:true,runtime_candidate:RUNTIME,bridge_ticket_digest:digest,bridge_ticket_expires_at_ms:Date.now()+900000,bridge_stage:"cloudflare_dispatching"});
    const out=await triggerBaiduBridge(env,{op:"SUBMIT",task_id:TASK_ID,bridge_ticket:ticket});
    await save(env,{status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,circleci_pipeline_number:out.pipeline_number,bridge_started_at:now()});
    return json({ok:true,task_id:TASK_ID,status:"bridge_submitted",circleci_pipeline_id:out.pipeline_id,runtime:RUNTIME,device:"v100",gpus:1,payment:"coupon",one_shot:true},202);
  }catch(e){await save(env,{status:"failed",failure_class:"CIRCLECI_DISPATCH_FAILED",error:String(e?.message||e).slice(0,300),finished_at:now(),bridge_ticket_digest:null});await release(env).catch(()=>{});return json({ok:false,error:String(e?.message||"CIRCLECI_DISPATCH_FAILED").slice(0,200)},502)}
}

async function acceptance(req,env){
  const u=new URL(req.url);if(u.pathname!==PATH)return null;
  if(Date.now()>EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
  if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const current=(await load(env)).task;
  if(current)return json({ok:current.status!=="failed",already_started:true,task:safeTask(current)},current.status==="completed"?200:current.status==="failed"?502:202);
  return start(env);
}

export default {async fetch(req,env,ctx){const d=await diagnosticCallback(req,env);if(d)return d;const a=await acceptance(req,env);if(a)return a;return base.fetch(req,env,ctx)}};
