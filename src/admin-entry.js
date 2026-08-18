import app,{CenterGate} from "./production-entry.js";
import {getAutonomySnapshot,runAutonomySweep} from "./provider-autonomy.js";
import {getModelScopeRuntimeSnapshot,runModelScopeRuntimeSweep} from "./modelscope-runtime-monitor.js";
import {probeModelScope} from "./modelscope-compute.js";
import {modelScopeInferenceCanary} from "./modelscope-inference.js";
import {getModelScopeStudioStatus} from "./modelscope-studio.js";
import {getModelScopeStudioLiteStatus,runModelScopeStudioLiteBootstrap,prepareModelScopeStudioLite,deployModelScopeStudioLite,stopModelScopeStudioLite} from "./modelscope-studio-lite.js";
import {ModelScopeStudioLiteWorkflow} from "./modelscope-studio-workflow.js";
import {intelligenceFreeStatusBridge} from "./intelligence-free-status-bridge.js";
export {CenterGate,ModelScopeStudioLiteWorkflow};

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
  return json({ok,selftest:"modelscope-compute-runtime",secret_present:probe.configured===true,authenticated:probe.authenticated===true,hardware_discovery_ok:probe.hardware_discovery_ok===true,free_hardware_verified:probe.free_hardware_verified===true,free_cpu_verified:probe.free_cpu_verified===true,route_eligible:probe.route_eligible===true,acceptance_state:probe.acceptance_state||null,alerts:Array.isArray(probe.alerts)?probe.alerts:[],upstream_http_status:probe.http_status||200,free_only:true,paid_fallback:false,runtime_e2e_verified:probe.current_runtime_e2e_verified===true,secrets_redacted:true},ok?200:503);
}

async function modelScopeInferenceSelftest(env){
  const p=await modelScopeInferenceCanary(env);
  return json({ok:p.ok===true,selftest:"modelscope-inference",secret_present:p.configured===true,authenticated:p.authenticated===true,inference_ok:p.inference_ok===true,http_status:p.http_status||null,model:p.model||null,canary_revision:p.canary_revision||null,response_mode:p.response_mode||null,stream_events:Number(p.stream_events||0),content_chars:Number(p.content_chars||0),reasoning_chars:Number(p.reasoning_chars||0),response_digest:p.response_digest||null,output_digest:p.output_digest||p.content_digest||null,expected:p.expected||null,correct:p.correct===true,error_class:p.error_class||null,free_only:true,paid_fallback:false,secrets_redacted:true},p.ok===true?200:503);
}

async function modelScopeStudioSelftest(env){const p=await getModelScopeStudioStatus(env);return json(p,p.runtime_e2e_verified===true?200:503)}
async function modelScopeStudioLiteSelftest(env){const p=await getModelScopeStudioLiteStatus(env);return json(p,p.runtime_e2e_verified===true?200:503)}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx),source=await readApp("/source",env,ctx),acceptance=await readApp("/v1/acceptance/latest",env,ctx),gate=await readGate(env),autonomy=await getAutonomySnapshot(env),modelscopeRuntime=await getModelScopeRuntimeSnapshot(env),version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true&&autonomy.ok===true;
  return json({ok,service:SERVICE,admin_read_only:true,observed_at:new Date().toISOString(),runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},health:health.body,source:source.body,acceptance:acceptance.body,autonomy,modelscope_runtime:modelscopeRuntime,alerts:{user_action_required:modelscopeRuntime?.status?.user_action_required===true,modelscope:modelscopeRuntime?.status?.hard_alerts||[]},active_task:gate.active||null,active_state_verified:gate.ok===true,secrets_redacted:true},ok?200:503);
}

function internalOnly(url,message){return url.hostname!=="compute.internal"?json({ok:false,error:"POLICY_DENIED",message},403):null}
async function internalStudioLite(env,phase){
  const fn=phase==="status"?getModelScopeStudioLiteStatus:phase==="prepare"?prepareModelScopeStudioLite:phase==="deploy"?deployModelScopeStudioLite:phase==="stop"?stopModelScopeStudioLite:runModelScopeStudioLiteBootstrap;
  const p=await fn(env);return json(p,p.ok===true?200:503);
}
async function startStudioLiteWorkflow(env){
  if(!env.MODELSCOPE_STUDIO_WORKFLOW?.create)return json({ok:false,error:"MODELSCOPE_STUDIO_WORKFLOW_UNAVAILABLE"},503);
  const id=`ms-lite-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  const instance=await env.MODELSCOPE_STUDIO_WORKFLOW.create({id,params:{requested_at:new Date().toISOString(),free_only:true},retention:{successRetention:"1 day",errorRetention:"1 day"}});
  return json({ok:true,runner:"modelscope-studio-lite-workflow",instance_id:instance.id,status:await instance.status(),free_only:true,paid_fallback:false,secrets_redacted:true});
}
async function getStudioLiteWorkflow(env,url){
  if(!env.MODELSCOPE_STUDIO_WORKFLOW?.get)return json({ok:false,error:"MODELSCOPE_STUDIO_WORKFLOW_UNAVAILABLE"},503);
  const id=String(url.searchParams.get("id")||"");
  if(!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,99}$/.test(id))return json({ok:false,error:"INVALID_WORKFLOW_INSTANCE_ID"},400);
  try{
    const instance=await env.MODELSCOPE_STUDIO_WORKFLOW.get(id);
    return json({ok:true,runner:"modelscope-studio-lite-workflow",instance_id:instance.id,status:await instance.status(),free_only:true,paid_fallback:false,secrets_redacted:true});
  }catch(e){return json({ok:false,error:"WORKFLOW_INSTANCE_LOOKUP_FAILED",message:String(e?.message||e)},404)}
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/intelligence-free-model-status")return intelligenceFreeStatusBridge(env);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-runtime")return modelScopeRuntimeSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-inference")return modelScopeInferenceSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-studio")return modelScopeStudioSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/selftest/modelscope-studio-lite")return modelScopeStudioLiteSelftest(env);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      const denied=internalOnly(url,"admin context is service-binding internal only");if(denied)return denied;return adminContext(env,ctx);
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/autonomy"){
      const denied=internalOnly(url,"autonomy status is service-binding internal only");if(denied)return denied;return json(await getAutonomySnapshot(env));
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/modelscope"){
      const denied=internalOnly(url,"ModelScope runtime status is service-binding internal only");if(denied)return denied;return json(await getModelScopeRuntimeSnapshot(env));
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/modelscope/studio-lite/status"){
      const denied=internalOnly(url,"ModelScope Studio Lite status is service-binding internal only");if(denied)return denied;return internalStudioLite(env,"status");
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/modelscope/studio-lite/prepare"){
      const denied=internalOnly(url,"ModelScope Studio Lite prepare is service-binding internal only");if(denied)return denied;return internalStudioLite(env,"prepare");
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/modelscope/studio-lite/deploy"){
      const denied=internalOnly(url,"ModelScope Studio Lite deploy is service-binding internal only");if(denied)return denied;return internalStudioLite(env,"deploy");
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/modelscope/studio-lite/stop"){
      const denied=internalOnly(url,"ModelScope Studio Lite stop is service-binding internal only");if(denied)return denied;return internalStudioLite(env,"stop");
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/modelscope/studio-lite-bootstrap"){
      const denied=internalOnly(url,"ModelScope Studio Lite bootstrap is service-binding internal only");if(denied)return denied;return internalStudioLite(env,"bootstrap");
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/modelscope/studio-lite/run"){
      const denied=internalOnly(url,"ModelScope Studio Lite Workflow start is service-binding internal only");if(denied)return denied;return startStudioLiteWorkflow(env);
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/modelscope/studio-lite/workflow"){
      const denied=internalOnly(url,"ModelScope Studio Lite Workflow status is service-binding internal only");if(denied)return denied;return getStudioLiteWorkflow(env,url);
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(Promise.all([runAutonomySweep(app,env,ctx),runModelScopeRuntimeSweep(env)]))}
};
