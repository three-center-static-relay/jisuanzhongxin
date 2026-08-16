import app,{CenterGate} from "./production-entry.js";
import {getAutonomySnapshot,runAutonomySweep} from "./provider-autonomy.js";
export {CenterGate};

const ORIGIN="https://compute.internal";
const SERVICE="compute-worker";
const P24_TASK_ID="baidu-circleci-live-20260816p24a";
const P24_DIAG_PATH="/__diagnostic/baidu-p24-result-20260816-8c1f416e63304bf98619ca9fd9f3cb58";
const P24_DIAG_EXPIRES_AT=Date.parse("2026-08-16T11:00:00Z");
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function gateRequest(env,path){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE"};
  const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));
  const response=await gate.fetch(new Request(`https://gate.internal${path}`,{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}

async function readGate(env){
  const out=await gateRequest(env,"/state");
  return {...out,active:out.active||null};
}

async function p24Diagnostic(env){
  if(Date.now()>P24_DIAG_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true,secrets_redacted:true},410);
  const out=await gateRequest(env,`/task/${encodeURIComponent(P24_TASK_ID)}`);
  const t=out.task||null;
  if(!t)return json({ok:false,error:"TASK_NOT_FOUND",diagnostic:true,task_id:P24_TASK_ID,secrets_redacted:true},404);
  const digest=String(t.result_digest||"");
  const verification=t.verification&&typeof t.verification==="object"?t.verification:{};
  const productionReady=String(t.status)==="completed"&&String(t.runtime_candidate||"")==="paddle2.4_py3.7"&&/^[a-f0-9]{64}$/i.test(digest)&&t.bridge_result_retrieved===true&&verification.v100_visible===true&&verification.paddle_cuda===true;
  return json({
    ok:productionReady,
    diagnostic:true,
    task_id:P24_TASK_ID,
    status:t.status||null,
    runtime_candidate:t.runtime_candidate||null,
    bridge_stage:t.bridge_stage||null,
    failure_class:t.failure_class||null,
    result_digest:digest||null,
    result_digest_present:/^[a-f0-9]{64}$/i.test(digest),
    bridge_result_retrieved:t.bridge_result_retrieved===true,
    verification:{
      v100_visible:verification.v100_visible===true,
      paddle_cuda:verification.paddle_cuda===true,
      gpu_name:verification.gpu_name||null,
      device:verification.device||null
    },
    finished_at:t.finished_at||null,
    production_ready:productionReady,
    secrets_redacted:true,
    result_body_exposed:false
  },productionReady?200:503);
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
    ctx.waitUntil(runAutonomySweep(app,env,ctx));
  }
};
