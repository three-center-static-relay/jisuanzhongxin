const PROVIDER="modal";
const STARTER_FREE_CREDIT_USD_MONTHLY=30;

export function modalMeta(){
  return {
    provider:PROVIDER,
    role:"general-serverless-cpu-gpu",
    plan:"starter",
    subscription_usd_monthly:0,
    recurring_free_compute_credit_usd_monthly:STARTER_FREE_CREDIT_USD_MONTHLY,
    free_credit_type:"recurring-monthly-current-plan",
    lifetime_free_guarantee:false,
    pricing_policy_can_change:true,
    api_token_id_env:"MODAL_TOKEN_ID",
    api_token_secret_env:"MODAL_TOKEN_SECRET",
    endpoint_url_env:"MODAL_ENDPOINT_URL",
    gpu_endpoint_url_env:"MODAL_GPU_ENDPOINT_URL",
    proxy_token_id_env:"MODAL_PROXY_TOKEN_ID",
    proxy_token_secret_env:"MODAL_PROXY_TOKEN_SECRET",
    runtime_transport:"https-web-function",
    direct_cloudflare_sdk_supported:false,
    direct_cloudflare_sdk_reason:"modal-js-uses-node-grpc-http2; Cloudflare Workers node:http2 is a non-functional compatibility stub",
    bridge_required:true,
    cpu:true,
    gpu:true,
    gpu_acceptance_type:"T4",
    paid_fallback:false,
    free_credit_only:true,
    historically_verified:true,
    route_eligible:false,
    route_eligibility:"live-health-required",
    route_scope:"bounded-compute",
    routing_policy:"cpu-first",
    gpu_only_when_required:true,
    gpu_trigger:"explicit-gpu-required-or-gpu-profile",
    monthly_budget_circuit_breaker:false,
    automatic_monthly_interrupt:false,
    acceptance_state:"cpu-t4-e2e-verified"
  };
}

export function chooseModalAccelerator(request={}){
  const profile=String(request?.profile||"").trim().toLowerCase();
  const explicitGpu=request?.gpu_required===true||request?.gpu===true;
  const gpuRequired=explicitGpu||profile==="gpu";
  return {
    provider:PROVIDER,
    accelerator:gpuRequired?"t4":"cpu",
    cpu_preferred:!gpuRequired,
    gpu_required:gpuRequired,
    reason:gpuRequired?(explicitGpu?"explicit-gpu-required":"gpu-profile"):"cpu-default",
    monthly_budget_circuit_breaker:false,
    automatic_monthly_interrupt:false,
    paid_fallback:false,
    free_credit_only:true
  };
}

function cleanBaseUrl(v){return String(v||"").trim().replace(/\/+$/g,"")}
function validHttpsUrl(v){try{const u=new URL(v);return u.protocol==="https:"}catch{return false}}
function deriveGpuEndpoint(cpuEndpoint){
  const base=cleanBaseUrl(cpuEndpoint);
  const suffix="-bridge.modal.run";
  if(!base.endsWith(suffix))return"";
  return `${base.slice(0,-suffix.length)}-gpu-selftest.modal.run`;
}
function bridgeConfig(env){
  const endpoint=cleanBaseUrl(env.MODAL_ENDPOINT_URL);
  const proxyId=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const proxySecret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  return {
    endpoint,proxyId,proxySecret,
    configured:Boolean(endpoint&&proxyId&&proxySecret),
    endpointValid:validHttpsUrl(endpoint),
    proxyIdValid:/^wk-[A-Za-z0-9_-]+$/.test(proxyId),
    proxySecretValid:/^ws-[A-Za-z0-9_-]+$/.test(proxySecret)
  };
}
function gpuConfig(env){
  const explicitGpuEndpoint=cleanBaseUrl(env.MODAL_GPU_ENDPOINT_URL);
  const derivedGpuEndpoint=deriveGpuEndpoint(env.MODAL_ENDPOINT_URL);
  const gpuEndpoint=explicitGpuEndpoint||derivedGpuEndpoint;
  const endpointSource=explicitGpuEndpoint?"explicit-binding":(derivedGpuEndpoint?"derived-from-cpu-endpoint":"missing");
  const proxyId=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const proxySecret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  return {
    gpuEndpoint,endpointSource,proxyId,proxySecret,
    configured:Boolean(gpuEndpoint&&proxyId&&proxySecret),
    endpointValid:validHttpsUrl(gpuEndpoint),
    proxyIdValid:/^wk-[A-Za-z0-9_-]+$/.test(proxyId),
    proxySecretValid:/^ws-[A-Za-z0-9_-]+$/.test(proxySecret)
  };
}
function authHeaders(proxyId,proxySecret,extra={}){
  return {"Modal-Key":proxyId,"Modal-Secret":proxySecret,"Accept":"application/json",...extra};
}

export async function modalHealth(env){
  const apiId=String(env.MODAL_TOKEN_ID||"").trim();
  const apiSecret=String(env.MODAL_TOKEN_SECRET||"").trim();
  const apiPairConfigured=Boolean(apiId&&apiSecret);
  const {endpoint,proxyId,proxySecret,configured,endpointValid,proxyIdValid,proxySecretValid}=bridgeConfig(env);
  const gpu=gpuConfig(env);
  const base={
    provider:PROVIDER,
    api_token_pair_configured:apiPairConfigured,
    api_token_id_format_ok:apiId?(/^ak-[A-Za-z0-9_-]+$/.test(apiId)):false,
    api_token_secret_format_ok:apiSecret?(/^as-[A-Za-z0-9_-]+$/.test(apiSecret)):false,
    direct_cloudflare_sdk_supported:false,
    bridge_required:true,
    endpoint_configured:Boolean(endpoint),
    gpu_endpoint_configured:Boolean(gpu.gpuEndpoint),
    gpu_endpoint_source:gpu.endpointSource,
    proxy_token_id_configured:Boolean(proxyId),
    proxy_token_secret_configured:Boolean(proxySecret),
    proxy_token_id_format_ok:proxyIdValid,
    proxy_token_secret_format_ok:proxySecretValid,
    routing_policy:"cpu-first",
    gpu_only_when_required:true,
    monthly_budget_circuit_breaker:false,
    automatic_monthly_interrupt:false,
    paid_fallback:false,
    free_credit_only:true,
    historically_verified:true,
    route_eligible:false,
    route_eligibility:"live-health-required",
    route_scope:"bounded-compute",
    secret_echo:false
  };
  if(!configured)return {ok:false,...base,authenticated:false,live_probe:false,acceptance_state:"https-bridge-config-required"};
  if(!endpointValid||!proxyIdValid||!proxySecretValid)return {ok:false,...base,authenticated:false,live_probe:false,error_class:"MODAL_BRIDGE_CONFIG_INVALID",acceptance_state:"https-bridge-config-invalid"};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const started=Date.now();
    const r=await fetch(`${endpoint}/health`,{method:"GET",headers:authHeaders(proxyId,proxySecret),signal:controller.signal});
    const ok=r.ok;
    return {ok,...base,route_eligible:ok,authenticated:ok,live_probe:true,http_status:r.status,probe_elapsed_ms:Date.now()-started,acceptance_state:ok?"https-bridge-authenticated-cpu-t4-verified":"https-bridge-health-failed"};
  }catch(e){
    return {ok:false,...base,route_eligible:false,authenticated:false,live_probe:true,error_class:e?.name==="AbortError"?"MODAL_BRIDGE_TIMEOUT":"MODAL_BRIDGE_UNAVAILABLE",acceptance_state:"https-bridge-health-failed"};
  }finally{clearTimeout(timer)}
}

export async function modalCpuSelftest(env,n=10000){
  const {endpoint,proxyId,proxySecret,configured,endpointValid,proxyIdValid,proxySecretValid}=bridgeConfig(env);
  if(!configured||!endpointValid||!proxyIdValid||!proxySecretValid)return {ok:false,provider:PROVIDER,error:"MODAL_BRIDGE_CONFIG_INVALID",route_eligible:false,secret_echo:false};
  if(!Number.isInteger(n)||n<1||n>100000)return {ok:false,provider:PROVIDER,error:"INVALID_N",allowed_range:[1,100000],route_eligible:false,secret_echo:false};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),35000);
  try{
    const started=Date.now();
    const r=await fetch(`${endpoint}/v1/selftest/cpu`,{
      method:"POST",
      headers:authHeaders(proxyId,proxySecret,{"Content-Type":"application/json"}),
      body:JSON.stringify({n}),
      signal:controller.signal
    });
    let upstream=null;
    try{upstream=await r.json()}catch{upstream=null}
    const expected=n*(n+1)*(2*n+1)/6;
    const checksumOk=Boolean(r.ok&&upstream?.ok===true&&Number(upstream?.checksum)===expected);
    return {
      ok:checksumOk,
      provider:PROVIDER,
      bridge_http_status:r.status,
      n,
      expected_checksum:expected,
      returned_checksum:upstream?.checksum??null,
      checksum_ok:checksumOk,
      modal_elapsed_ms:upstream?.elapsed_ms??null,
      roundtrip_elapsed_ms:Date.now()-started,
      selftest:upstream?.selftest??null,
      route_eligible:checksumOk,
      route_scope:"bounded-compute",
      routing_policy:"cpu-first",
      paid_fallback:false,
      free_credit_only:true,
      secret_echo:false,
      acceptance_state:checksumOk?"cpu-e2e-pass":"cpu-e2e-failed"
    };
  }catch(e){
    return {ok:false,provider:PROVIDER,error:e?.name==="AbortError"?"MODAL_CPU_E2E_TIMEOUT":"MODAL_CPU_E2E_UNAVAILABLE",route_eligible:false,route_scope:"bounded-compute",paid_fallback:false,free_credit_only:true,secret_echo:false,acceptance_state:"cpu-e2e-failed"};
  }finally{clearTimeout(timer)}
}

export async function modalGpuSelftest(env,n=10000){
  const {gpuEndpoint,endpointSource,proxyId,proxySecret,configured,endpointValid,proxyIdValid,proxySecretValid}=gpuConfig(env);
  if(!configured)return {ok:false,provider:PROVIDER,error:"MODAL_GPU_ENDPOINT_CONFIG_REQUIRED",gpu_endpoint_configured:Boolean(gpuEndpoint),gpu_endpoint_source:endpointSource,route_eligible:false,route_scope:"bounded-compute",paid_fallback:false,free_credit_only:true,secret_echo:false};
  if(!endpointValid||!proxyIdValid||!proxySecretValid)return {ok:false,provider:PROVIDER,error:"MODAL_GPU_CONFIG_INVALID",gpu_endpoint_source:endpointSource,route_eligible:false,route_scope:"bounded-compute",paid_fallback:false,free_credit_only:true,secret_echo:false};
  if(!Number.isInteger(n)||n<1||n>100000)return {ok:false,provider:PROVIDER,error:"INVALID_N",allowed_range:[1,100000],route_eligible:false,secret_echo:false};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),60000);
  try{
    const started=Date.now();
    const r=await fetch(gpuEndpoint,{
      method:"POST",
      headers:authHeaders(proxyId,proxySecret,{"Content-Type":"application/json"}),
      body:JSON.stringify({n}),
      signal:controller.signal
    });
    let upstream=null;
    try{upstream=await r.json()}catch{upstream=null}
    const expected=n*(n+1)*(2*n+1)/6;
    const checksumOk=Boolean(r.ok&&upstream?.ok===true&&Number(upstream?.checksum)===expected);
    const cudaOk=Boolean(upstream?.cuda_available===true&&String(upstream?.device_type||"")==="cuda");
    const gpuOk=Boolean(checksumOk&&cudaOk&&String(upstream?.gpu_requested||"").toUpperCase()==="T4");
    return {
      ok:gpuOk,
      provider:PROVIDER,
      bridge_http_status:r.status,
      gpu_endpoint_source:endpointSource,
      gpu_requested:"T4",
      cuda_available:Boolean(upstream?.cuda_available),
      device_type:String(upstream?.device_type||"").slice(0,40),
      device_name:String(upstream?.device_name||"").slice(0,120),
      n,
      expected_checksum:expected,
      returned_checksum:upstream?.checksum??null,
      checksum_ok:checksumOk,
      modal_elapsed_ms:upstream?.elapsed_ms??null,
      roundtrip_elapsed_ms:Date.now()-started,
      selftest:upstream?.selftest??null,
      route_eligible:gpuOk,
      route_scope:"bounded-compute",
      routing_policy:"gpu-only-when-required",
      paid_fallback:false,
      free_credit_only:true,
      secret_echo:false,
      acceptance_state:gpuOk?"gpu-e2e-pass":"gpu-e2e-failed"
    };
  }catch(e){
    return {ok:false,provider:PROVIDER,error:e?.name==="AbortError"?"MODAL_GPU_E2E_TIMEOUT":"MODAL_GPU_E2E_UNAVAILABLE",gpu_endpoint_source:endpointSource,route_eligible:false,route_scope:"bounded-compute",paid_fallback:false,free_credit_only:true,secret_echo:false,acceptance_state:"gpu-e2e-failed"};
  }finally{clearTimeout(timer)}
}
