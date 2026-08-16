import app,{CenterGate} from "./production-entry.js";
import {digestBridgeTicket,newBridgeTicket,triggerBaiduBridge} from "./baidu-circleci.js";
import {getAutonomySnapshot,runAutonomySweep} from "./provider-autonomy.js";
export {CenterGate};

const ORIGIN="https://compute.internal";
const SERVICE="compute-worker";
const P24_SOURCE_TASK_ID="baidu-circleci-live-20260816p24a";
const P24_DIAG_TASK_ID="baidu-circleci-diag-20260816p24a-1";
const P24_DIAG_CRON="* * * * *";
const P24_DIAG_PATH="/__diagnostic/baidu-p24-terminal-detail-20260816-6b5f0e91d6374e8aa65a2c4b2e795b3c";
const P24_DIAG_EXPIRES_AT=Date.parse("2026-08-16T11:25:00Z");
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

function gateHandle(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function gateCall(env,path,method="GET",body){
  const init={method,headers:{"content-type":"application/json"}};
  if(body!==undefined)init.body=JSON.stringify(body);
  const response=await gateHandle(env).fetch(new Request(`https://gate.internal${path}`,init));
  return {http_status:response.status,...await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))};
}
async function loadTask(env,id){return gateCall(env,`/task/${encodeURIComponent(id)}`)}
async function saveTask(env,id,patch){return gateCall(env,`/task/${encodeURIComponent(id)}`,"POST",patch)}

async function runP24ReadOnlyCheck(env){
  if(Date.now()>P24_DIAG_EXPIRES_AT)return {ok:false,error:"DIAGNOSTIC_EXPIRED"};
  const existing=(await loadTask(env,P24_DIAG_TASK_ID)).task;
  if(existing)return {ok:true,already_dispatched:true,status:existing.status||null};
  const source=(await loadTask(env,P24_SOURCE_TASK_ID)).task;
  if(!source||source.executor!=="baidu-circleci-cli"||source.status!=="failed"){
    await saveTask(env,P24_DIAG_TASK_ID,{status:"failed",executor:"baidu-circleci-cli",read_only_diagnostic:true,failure_class:"DIAGNOSTIC_SOURCE_STATE_INVALID",created_at:new Date().toISOString(),finished_at:new Date().toISOString()});
    return {ok:false,error:"DIAGNOSTIC_SOURCE_STATE_INVALID"};
  }
  const jobId=String(source.baidu_job_id||"").trim();
  if(!jobId){
    await saveTask(env,P24_DIAG_TASK_ID,{status:"failed",executor:"baidu-circleci-cli",read_only_diagnostic:true,failure_class:"DIAGNOSTIC_SOURCE_JOB_ID_MISSING",created_at:new Date().toISOString(),finished_at:new Date().toISOString()});
    return {ok:false,error:"DIAGNOSTIC_SOURCE_JOB_ID_MISSING"};
  }
  const ticket=newBridgeTicket();
  const ticketDigest=await digestBridgeTicket(ticket);
  await saveTask(env,P24_DIAG_TASK_ID,{
    status:"diagnostic_dispatching",
    executor:"baidu-circleci-cli",
    profile:"gpu",
    gpu:false,
    read_only_diagnostic:true,
    diagnostic_operation:"CHECK",
    source_task_id:P24_SOURCE_TASK_ID,
    baidu_job_id:jobId,
    bridge_ticket_digest:ticketDigest,
    bridge_ticket_expires_at_ms:Date.now()+15*60*1000,
    created_at:new Date().toISOString()
  });
  try{
    const out=await triggerBaiduBridge(env,{op:"CHECK",task_id:P24_DIAG_TASK_ID,baidu_job_id:jobId,bridge_ticket:ticket});
    await saveTask(env,P24_DIAG_TASK_ID,{status:"diagnostic_submitted",circleci_pipeline_id:out.pipeline_id||null,circleci_pipeline_number:out.pipeline_number||null,bridge_started_at:new Date().toISOString()});
    return {ok:true,status:"diagnostic_submitted"};
  }catch(e){
    await saveTask(env,P24_DIAG_TASK_ID,{status:"failed",failure_class:"DIAGNOSTIC_CIRCLECI_DISPATCH_FAILED",error:String(e?.message||e).slice(0,200),bridge_ticket_digest:null,finished_at:new Date().toISOString()});
    return {ok:false,error:"DIAGNOSTIC_CIRCLECI_DISPATCH_FAILED"};
  }
}

async function p24Diagnostic(env){
  if(Date.now()>P24_DIAG_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true,read_only:true,secrets_redacted:true},410);
  const task=(await loadTask(env,P24_DIAG_TASK_ID)).task;
  if(!task)return json({ok:false,error:"DIAGNOSTIC_NOT_DISPATCHED",diagnostic:true,read_only:true,secrets_redacted:true},404);
  const terminal=["completed","failed","cancelled"].includes(String(task.status||""));
  return json({
    ok:terminal,
    diagnostic:true,
    read_only:true,
    operation:"CHECK",
    gpu_submit:false,
    task_id:P24_DIAG_TASK_ID,
    status:task.status||null,
    failure_class:task.failure_class||null,
    bridge_stage:task.bridge_stage||null,
    upstream_diagnostic:task.upstream_diagnostic||null,
    circleci_pipeline_id_present:Boolean(task.circleci_pipeline_id),
    baidu_job_id_present:Boolean(task.baidu_job_id),
    finished_at:task.finished_at||null,
    secrets_redacted:true,
    source_job_id_exposed:false,
    result_body_exposed:false
  },terminal?200:202);
}

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function readGate(env){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE",active:null};
  const response=await gateHandle(env).fetch(new Request("https://gate.internal/state",{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gate=await readGate(env);
  const autonomy=await getAutonomySnapshot(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true&&autonomy.ok===true;
  return json({
    ok,
    service:SERVICE,
    admin_read_only:true,
    observed_at:new Date().toISOString(),
    runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},
    health:health.body,
    source:source.body,
    acceptance:acceptance.body,
    autonomy,
    active_task:gate.active||null,
    active_state_verified:gate.ok===true,
    secrets_redacted:true
  },ok?200:503);
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname===P24_DIAG_PATH)return p24Diagnostic(env);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"admin context is service-binding internal only"},403);
      return adminContext(env,ctx);
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/autonomy"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"autonomy status is service-binding internal only"},403);
      return json(await getAutonomySnapshot(env));
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(controller,env,ctx){
    if(String(controller?.cron||"")===P24_DIAG_CRON){ctx.waitUntil(runP24ReadOnlyCheck(env));return}
    ctx.waitUntil(runAutonomySweep(app,env,ctx));
  }
};
