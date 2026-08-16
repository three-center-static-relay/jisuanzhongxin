const ORIGIN="https://compute.internal";
const STATE_PREFIX="autonomy-provider:";
const PROVIDER_IDS=["kaggle","modal","baidu"];

export const AUTONOMY_POLICY=Object.freeze({
  schema:"free-compute-fabric-autonomy-v1",
  free_only:true,
  paid_fallback:false,
  user_routine_maintenance_required:false,
  scheduled_gpu_canary:false,
  probe_cadence:"daily-control-plane",
  quarantine_after_consecutive_failures:2,
  recover_after_consecutive_successes:2,
  retry_policy:"bounded-no-loop",
  runtime_upgrade_policy:"candidate-canary-promote",
  production_upgrade_policy:"keep-last-verified-until-candidate-pass",
  notify_user_only_for:["ALL_VERIFIED_PROVIDERS_UNAVAILABLE","AUTH_REQUIRES_HUMAN","TERMS_OR_REALNAME_ACTION_REQUIRED","FREE_TIER_REMOVED_OR_BILLING_REQUIRED"]
});

export const BAIDU_RUNTIME_POLICY=Object.freeze({
  sdk:"aistudio-sdk==0.3.8",
  device:"v100",
  gpus:1,
  payment:"coupon",
  acoin_allowed:false,
  paid_fallback:false,
  production_runtime:null,
  candidate_runtime:"paddle2.5_py3.10",
  candidate_state:"CANDIDATE",
  quarantined_runtimes:["paddle2.6_py3.10"],
  fallback_candidates:["paddle2.4_py3.7"],
  promotion_requires:["live_e2e","v100_cuda_verified","result_digest","bridge_result_retrieved"]
});

const definitions={
  kaggle:{meta:"/v1/providers/kaggle/meta",health:"/v1/providers/kaggle/health",e2e_required:true,billing_guard:"no-paid-path-in-router"},
  modal:{meta:"/v1/providers/modal/meta",health:"/v1/providers/modal/health",e2e_required:true,billing_guard:"free-credit-only"},
  baidu:{meta:"/v1/providers/baidu/bridge/meta",health:null,e2e_required:true,billing_guard:"coupon-only"}
};

const now=()=>new Date().toISOString();
const int=v=>Number.isFinite(Number(v))?Math.max(0,Math.trunc(Number(v))):0;

function gate(env){return env.CENTER_GATE?.get?.(env.CENTER_GATE.idFromName("global"))||null}
async function gateCall(env,path,method="GET",body){
  const g=gate(env);if(!g)return{ok:false,error:"CENTER_GATE_UNAVAILABLE"};
  const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);
  const r=await g.fetch(new Request(`https://gate.internal${path}`,init));
  return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))};
}
async function load(env,id){return(await gateCall(env,`/task/${encodeURIComponent(STATE_PREFIX+id)}`)).task||null}
async function save(env,id,patch){return gateCall(env,`/task/${encodeURIComponent(STATE_PREFIX+id)}`,"POST",{kind:"provider-health",provider:id,...patch})}

async function call(app,path,env,ctx){
  try{
    const r=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
    const body=await r.json().catch(()=>({ok:false,error:"BAD_JSON"}));
    return{http_status:r.status,ok:r.ok&&body?.ok===true,body};
  }catch(e){return{http_status:0,ok:false,body:{ok:false,error:String(e?.message||"PROBE_FAILED").slice(0,120)}}}
}

function configured(id,meta,health){
  if(id==="kaggle")return health?.configured===true;
  if(id==="modal")return health?.endpoint_configured===true&&health?.proxy_token_id_configured===true&&health?.proxy_token_secret_configured===true;
  if(id==="baidu")return meta?.configured===true;
  return false;
}
function freeGuard(id,meta,health){
  if(id==="kaggle")return true;
  if(id==="modal")return meta?.free_credit_only===true&&meta?.paid_fallback===false&&health?.free_credit_only===true&&health?.paid_fallback===false;
  if(id==="baidu")return meta?.baidu_payment==="coupon"&&meta?.paid_fallback!==true&&meta?.acoin_allowed!==true;
  return false;
}
function accepted(id,meta,health){
  if(id==="kaggle")return meta?.business_e2e===true&&health?.business_e2e===true;
  if(id==="modal")return meta?.route_eligible===true&&meta?.acceptance_state==="cpu-t4-e2e-verified";
  if(id==="baidu")return meta?.e2e_verified===true&&meta?.route_eligible===true;
  return false;
}

function transition(id,previous,observation){
  const prev=previous||{};
  let failures=int(prev.consecutive_failures),successes=int(prev.consecutive_successes),state="CANDIDATE",reason="INITIAL_EVALUATION";
  if(!observation.configured){state="DISABLED";reason="NOT_CONFIGURED";failures=0;successes=0}
  else if(!observation.free_guard_ok){state="DISABLED";reason="FREE_ONLY_GUARD_FAILED";failures=0;successes=0}
  else if(definitions[id].e2e_required&&!observation.accepted){state="QUARANTINED";reason="LIVE_E2E_NOT_VERIFIED";failures=Math.max(1,failures);successes=0}
  else if(!observation.probe_ok){failures+=1;successes=0;state=failures>=AUTONOMY_POLICY.quarantine_after_consecutive_failures?"QUARANTINED":"DEGRADED";reason="CONTROL_PLANE_PROBE_FAILED"}
  else{
    failures=0;successes+=1;
    const recovering=["QUARANTINED","DEGRADED"].includes(String(prev.state||""));
    if(recovering&&successes<AUTONOMY_POLICY.recover_after_consecutive_successes){state="DEGRADED";reason="RECOVERY_CONFIRMATION_PENDING"}
    else{state="VERIFIED";reason="HEALTHY_AND_ACCEPTED"}
  }
  return{state,reason,consecutive_failures:failures,consecutive_successes:successes};
}

async function observe(app,env,ctx,id){
  const def=definitions[id],metaResponse=await call(app,def.meta,env,ctx);
  const healthResponse=def.health?await call(app,def.health,env,ctx):metaResponse;
  const meta=metaResponse.body||{},health=healthResponse.body||{};
  const cfg=configured(id,meta,health),free=freeGuard(id,meta,health),acc=accepted(id,meta,health);
  return{
    configured:cfg,
    free_guard_ok:free,
    accepted:acc,
    probe_ok:metaResponse.ok&&healthResponse.ok,
    meta_http_status:metaResponse.http_status,
    health_http_status:healthResponse.http_status,
    acceptance_state:String(meta.acceptance_state||health.acceptance_state||"unknown").slice(0,80),
    route_eligible:meta.route_eligible===true,
    e2e_verified:id==="baidu"?meta.e2e_verified===true:acc,
    free_only:true,
    paid_fallback:false,
    checked_at:now()
  };
}

export async function runAutonomySweep(app,env,ctx){
  const results=[];
  for(const id of PROVIDER_IDS){
    const previous=await load(env,id);
    const observation=await observe(app,env,ctx,id);
    const next=transition(id,previous,observation);
    const record={...next,observation,last_checked_at:observation.checked_at,last_success_at:next.state==="VERIFIED"?observation.checked_at:(previous?.last_success_at||null),last_failure_at:["DEGRADED","QUARANTINED"].includes(next.state)?observation.checked_at:(previous?.last_failure_at||null),free_only:true,paid_fallback:false,user_action_required:false};
    await save(env,id,record);
    results.push({provider:id,state:record.state,reason:record.reason,free_only:true,paid_fallback:false});
  }
  return{ok:true,policy:AUTONOMY_POLICY.schema,checked_at:now(),providers:results,gpu_canary_started:false,user_action_required:false};
}

export async function getAutonomySnapshot(env){
  const providers=[];
  for(const id of PROVIDER_IDS){
    const rec=await load(env,id);
    providers.push(rec?{provider:id,state:rec.state||"CANDIDATE",reason:rec.reason||null,consecutive_failures:int(rec.consecutive_failures),consecutive_successes:int(rec.consecutive_successes),last_checked_at:rec.last_checked_at||null,last_success_at:rec.last_success_at||null,last_failure_at:rec.last_failure_at||null,free_only:true,paid_fallback:false}:{provider:id,state:"CANDIDATE",reason:"AWAITING_FIRST_AUTONOMY_SWEEP",consecutive_failures:0,consecutive_successes:0,last_checked_at:null,last_success_at:null,last_failure_at:null,free_only:true,paid_fallback:false});
  }
  return{ok:true,policy:AUTONOMY_POLICY,baidu_runtime_policy:BAIDU_RUNTIME_POLICY,providers,user_routine_maintenance_required:false};
}
