import base,{CenterGate as BaseCenterGate} from "./index.js";
import {getStatus,getOutput,removeKernel,introspect} from "./kaggle-official.js";
import {cancelKernel,probeMcp} from "./kaggle-mcp.js";
const MAX_LEASE_SECONDS=7200;
const INTERNAL_ONLY=new Set(["/v1/run","/v1/status","/v1/cancel","/v1/selftest"]);
const LIVE_DIAG_PATH="/__diag/kaggle-live-41d820f5-4211-47dc-bf08-0b5316d602ae";
const LIVE_DIAG_EXPIRES=Date.parse("2026-08-15T04:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const err=(c,m,s=400,d)=>json({ok:false,error:c,message:m,...(d?{details:d}:{})},s);
export class CenterGate{
  constructor(state,env){this.inner=new BaseCenterGate(state,env)}
  async fetch(req){const u=new URL(req.url);if(req.method==="POST"&&u.pathname==="/acquire"){const b=await req.clone().json().catch(()=>({})),requested=Number(b.lease_seconds||0),leaseSeconds=Math.max(300,Math.min(MAX_LEASE_SECONDS,(Number.isFinite(requested)?Math.trunc(requested):300)+180));req=new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({...b,lease_seconds:leaseSeconds})})}return this.inner.fetch(req)}
}
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function load(env,id){return g(env,`/task/${encodeURIComponent(id)}`)}
async function save(env,id,p){return g(env,`/task/${encodeURIComponent(id)}`,"POST",p)}
async function release(env,id){return g(env,"/release","POST",{task_id:id})}
function terminalStored(s){return["completed","failed","cancelled"].includes(String(s||""))}
function validResult(task,result){if(!result||result.ok!==true||String(result.task_id)!==String(task.task_id)||String(result.profile)!==String(task.profile))return{ok:false,reason:"RESULT_IDENTITY_MISMATCH"};if(task.gpu){if(result.accelerator!=="t4"||result.cuda!==true||!/t4/i.test(String(result.device||"")))return{ok:false,reason:"T4_VERIFICATION_FAILED"};if(Number(result.relative_error)>0.05)return{ok:false,reason:"GPU_CPU_CONSISTENCY_FAILED"}}else{if(result.accelerator!=="cpu")return{ok:false,reason:"CPU_VERIFICATION_FAILED"};if(!(Number(result.pi)>3.10&&Number(result.pi)<3.18))return{ok:false,reason:"MONTE_CARLO_SANITY_FAILED"};if(Number(result.linear_residual)>1e-6)return{ok:false,reason:"LINEAR_SOLVE_SANITY_FAILED"}}return{ok:true}}
async function finish(env,id,task,status,failure=""){
  let result=null,logDigest=null,cleanup=false,verification={ok:false,reason:"NOT_COMPLETED"};
  try{if(status==="completed"){const out=await getOutput(env,task);result=out.result;logDigest=out.log_digest;verification=validResult(task,result);if(!verification.ok)status="failed"}}catch(e){status="failed";failure=String(e?.message||e);verification={ok:false,reason:"OUTPUT_RETRIEVAL_FAILED"}}
  cleanup=await removeKernel(env,task).catch(()=>false);
  await save(env,id,{status,error:status==="failed"?(failure||verification.reason):null,result_digest:logDigest,verification,temporary_kernel_deleted:cleanup,finished_at:new Date().toISOString()});await release(env,id);
  if(status==="completed")return json({ok:true,task_id:id,status,result,verification,temporary_kernel_deleted:cleanup});
  if(status==="cancelled")return json({ok:true,task_id:id,status,temporary_kernel_deleted:cleanup});
  return err("UPSTREAM_TASK_FAILED",failure||verification.reason||"Kaggle task failed",502,{task_id:id,verification,temporary_kernel_deleted:cleanup});
}
async function status(req,env){const b=await req.json().catch(()=>({})),id=String(b.task_id||"");if(!id)return err("INVALID_REQUEST","task_id required",400);const t=await load(env,id),task=t.task;if(!task)return err("TASK_NOT_FOUND","Task not found",404);if(terminalStored(task.status))return json({ok:task.status!=="failed",task_id:id,status:task.status,result_digest:task.result_digest||null,verification:task.verification||null});if(!task.user_name||!task.kernel_slug)return err("TASK_NOT_READY","Kaggle task metadata is incomplete",409,{task_id:id});try{const s=await getStatus(env,task);if(["queued","running","cancel_requested"].includes(s.status)){await save(env,id,{status:s.status,kaggle_failure_message:s.failure_message||null,last_polled_at:new Date().toISOString()});return json({ok:true,task_id:id,status:s.status,lock_released:false},202)}if(s.status==="completed")return await finish(env,id,task,"completed",s.failure_message);if(s.status==="cancelled")return await finish(env,id,task,"cancelled",s.failure_message);return await finish(env,id,task,"failed",s.failure_message||"Kaggle reported ERROR")}catch(e){return err(e?.message||"UPSTREAM_UNAVAILABLE","Kaggle official status failed; lock retained",e?.status||502,{task_id:id,lock_retained:true})}}
async function cancel(req,env){const b=await req.json().catch(()=>({})),id=String(b.task_id||"");if(!id)return err("INVALID_REQUEST","task_id required",400);const t=await load(env,id),task=t.task;if(!task)return err("TASK_NOT_FOUND","Task not found",404);if(terminalStored(task.status))return json({ok:true,task_id:id,status:task.status,lock_retained:false});await g(env,`/task/${encodeURIComponent(id)}/cancel`,"POST",{});try{const r=await cancelKernel(env,task);await save(env,id,{status:"cancel_requested",cancel_dispatch_ok:true,cancel_transport:"kaggle-official-mcp",cancel_tool:r.tool,cancel_requested_at:new Date().toISOString()});return json({ok:true,task_id:id,status:"cancel_requested",lock_retained:true,transport:"kaggle-official-mcp"},202)}catch(e){await save(env,id,{cancel_dispatch_ok:false,cancel_error:String(e?.message||e)});return err(e?.message||"KAGGLE_CANCEL_FAILED","Kaggle cancel failed; lock retained",e?.status||502,{task_id:id,lock_retained:true})}}
async function selftest(env){try{const who=await introspect(env),mcp=await probeMcp(env),ok=who.active===true&&mcp.ok===true&&mcp.notebook_tools>0;return json({ok,selftest_level:"live-control-plane",business_e2e:false,service:"compute-worker",executor:"kaggle-official",token_active:who.active===true,username_resolved:Boolean(who.username),mcp_authenticated:mcp.ok===true,mcp_tools_count:mcp.tools_count,mcp_notebook_tools:mcp.notebook_tools,mcp_cancel_tool_present:mcp.cancel_tool_present,bridge_required:false},ok?200:503)}catch(e){return err(e?.message||"KAGGLE_SELFTEST_FAILED","Kaggle live control-plane selftest failed",e?.status||503,{business_e2e:false})}}
function diagTaskId(id){const x=String(id||"");return x.startsWith("live-accept-")&&x.length<120?x:null}
async function liveDiag(req,env,ctx){
  if(Date.now()>LIVE_DIAG_EXPIRES)return err("DIAG_EXPIRED","Live acceptance route expired",410);
  const b=await req.json().catch(()=>({})),action=String(b.action||"");
  if(action==="token_probe"){try{const who=await introspect(env);return json({ok:who.active===true,token_active:who.active===true,username_resolved:Boolean(who.username),secret_echo:false},who.active===true?200:503)}catch(e){return err(e?.message||"TOKEN_PROBE_FAILED","Kaggle token introspection failed",e?.status||503,{secret_echo:false})}}
  if(action==="cpu_start"||action==="t4_start"||action==="cancel_start"){
    const gpu=action==="t4_start",id=`live-accept-${action}-${crypto.randomUUID()}`;
    const input=gpu?{matrix_size:1024,rounds:1,seed:20260815}:action==="cancel_start"?{matrix_size:768,monte_carlo_samples:1500000,seed:20260815}:{matrix_size:256,monte_carlo_samples:250000,seed:20260815};
    const r=await base.fetch(new Request("https://compute.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:id,profile:gpu?"gpu":"core",gpu,timeout_seconds:420,input})}),env,ctx);
    const out=await r.json().catch(()=>null);return json({ok:r.ok,status_code:r.status,task_id:id,status:out?.status||null,machine_shape:out?.machine_shape||null},r.status);
  }
  const id=diagTaskId(b.task_id);if(!id)return err("INVALID_REQUEST","valid live acceptance task_id required",400);
  if(action==="status"){const r=await status(new Request("https://compute.internal/v1/status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:id})}),env);const out=await r.json().catch(()=>null);return json(out||{ok:false},r.status)}
  if(action==="cancel"){const r=await cancel(new Request("https://compute.internal/v1/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:id})}),env);const out=await r.json().catch(()=>null);return json(out||{ok:false},r.status)}
  return err("INVALID_REQUEST","action must be token_probe, cpu_start, t4_start, cancel_start, status, or cancel",400);
}
export default{async fetch(req,env,ctx){try{const u=new URL(req.url);if(req.method==="POST"&&u.pathname===LIVE_DIAG_PATH)return await liveDiag(req,env,ctx);if(req.method==="POST"&&INTERNAL_ONLY.has(u.pathname)&&u.hostname!=="compute.internal")return err("POLICY_DENIED","compute execution routes are service-binding internal only",403);if(req.method==="POST"&&u.pathname==="/v1/status")return await status(req,env);if(req.method==="POST"&&u.pathname==="/v1/cancel")return await cancel(req,env);if(req.method==="POST"&&u.pathname==="/v1/selftest")return await selftest(env);return await base.fetch(req,env,ctx)}catch(e){return err(e?.message||"INTERNAL_ERROR","Request failed",e?.status||500)}}};