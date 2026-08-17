import app,{CenterGate} from "./production-entry.js";
import {getAutonomySnapshot,runAutonomySweep} from "./provider-autonomy.js";
import {getModelScopeRuntimeSnapshot,runModelScopeRuntimeSweep} from "./modelscope-runtime-monitor.js";
import {probeModelScope} from "./modelscope-compute.js";
import {modelScopeInferenceCanary} from "./modelscope-inference.js";
export {CenterGate};

const ORIGIN="https://compute.internal";
const SERVICE="compute-worker";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function readGate(env){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE",active:null};
  const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));
  const response=await gate.fetch(new Request("https://gate.internal/state",{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}

async function modelScopeRuntimeSelftest(env){
  const probe=await probeModelScope(env);
  const ok=probe.ok===true&&probe.configured===true&&probe.authenticated===true&&probe.hardware_discovery_ok===true;
  return json({
    ok,
    selftest:"modelscope-compute-runtime",
    secret_present:probe.configured===true,
    authenticated:probe.authenticated===true,
    hardware_discovery_ok:probe.hardware_discovery_ok===true,
    free_hardware_verified:probe.free_hardware_verified===true,
    free_cpu_verified:probe.free_cpu_verified===true,
    route_eligible:probe.route_eligible===true,
    acceptance_state:probe.acceptance_state||null,
    alerts:Array.isArray(probe.alerts)?probe.alerts:[],
    upstream_http_status:probe.http_status||200,
    free_only:true,
    paid_fallback:false,
    runtime_e2e_verified:probe.current_runtime_e2e_verified===true,
    secrets_redacted:true
  },ok?200:503);
}

async function modelScopeInferenceSelftest(env){
  const p=await modelScopeInferenceCanary(env);
  return json({
    ok:p.ok===true,
    selftest:"modelscope-inference",
    secret_present:p.configured===true,
    authenticated:p.authenticated===true,
    inference_ok:p.inference_ok===true,
    http_status:p.http_status||null,
    model:p.model||null,
    canary_revision:p.canary_revision||null,
    response_mode:p.response_mode||null,
    stream_events:Number(p.stream_events||0),
    content_chars:Number(p.content_chars||0),
    reasoning_chars:Number(p.reasoning_chars||0),
    response_digest:p.response_digest||null,
    output_digest:p.output_digest||p.content_digest||null,
    expected:p.expected||null,
    correct:p.correct===true,
    error_class:p.error_class||null,
    free_only:true,
    paid_fallback:false,
    secrets_redacted:true
  },p.ok===true?200:503);
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gate=await readGate(env);
  const autonomy=await getAutonomySnapshot(env);
  const modelscopeRuntime=await getModelScopeRuntimeSnapshot(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true&&autonomy.ok===true;
  return json({ok,service:SERVICE,admin_read_only:true,observed_at:new Date().toISOString(),runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},health:health.body,source:source.body,acceptance:acceptance.body,autonomy,modelscope_runtime:modelscopeRuntime,alerts:{user_action_required:modelscopeRuntime?.status?.user_action_required===true,modelscope:modelscopeRuntime?.status?.hard_alerts||[]},active_task:gate.active||null,active_state_verified:gate.ok===true,secrets_redacted:true},ok?200:503);
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-runtime")return modelScopeRuntimeSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-inference")return modelScopeInferenceSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"admin context is service-binding internal only"},403);
      return adminContext(env,ctx);
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/autonomy"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"autonomy status is service-binding internal only"},403);
      return json(await getAutonomySnapshot(env));
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/modelscope"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"ModelScope runtime status is service-binding internal only"},403);
      return json(await getModelScopeRuntimeSnapshot(env));
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(_controller,env,ctx){
    ctx.waitUntil(Promise.all([runAutonomySweep(app,env,ctx),runModelScopeRuntimeSweep(env)]));
  }
};
