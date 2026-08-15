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
    arbitrary_code_route:false,
    route_eligible:false,
    acceptance_state:"cpu-e2e-pass-gpu-e2e-required"
  };
}

function cleanBaseUrl(v){return String(v||"").trim().replace(/\/+$/g,"")}
function validHttpsUrl(v){try{const u=new URL(v);return u.protocol==="https:"}catch{return false}}
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
  const gpuEndpoint=cleanBaseUrl(env.MODAL_GPU_ENDPOINT_URL);
  const proxyId=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const proxySecret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  return {
    gpuEndpoint,proxyId,proxySecret,
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
  const gpuEndpoint=cleanBaseUrl(env.MODAL_GPU_ENDPOINT_URL);
  const base={
    provider:PROVIDER,
    api_token_pair_configured:apiPairConfigured,
    api_token_id_format_ok:apiId?(/^ak-[A-Za-z0-9_-]+$/.test(apiId)):false,
    api_token_secret_format_ok:apiSecret?(/^as-[A-Za-z0-9_-]+$/.test(apiSecret)):false,
    direct_cloudflare_sdk_supported:false,
    bridge_required:true,
    endpoint_configured:Boolean(endpoint),
    gpu_endpoint_configured:Boolean(gpuEndpoint),
    proxy_token_id_configured:Boolean(proxyId),
    proxy_token_secret_configured:Boolean(proxySecret),
    proxy_token_id_format_ok:proxyIdValid,
    proxy_token_secret_format_ok:proxySecretValid,
    paid_fallback:false,
    free_credit_only:true,
    route_eligible:false,
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
    return {ok,...base,authenticated:ok,live_probe:true,http_status:r.status,probe_elapsed_ms:Date.now()-started,acceptance_state:ok?"https-bridge-authenticated-cpu-pass-gpu-pending":"https-bridge-health-failed"};
  }catch(e){
    return {ok:false,...base,authenticated:false,live_probe:true,error_class:e?.name==="AbortError"?"MODAL_BRIDGE_TIMEOUT":"MODAL_BRIDGE_UNAVAILABLE",acceptance_state:"https-bridge-health-failed"};
  }finally{clearTimeout(timer)}
}

export async function modalCpuSelftest(env,n=10000){
  const {endpoint,proxyId,proxySecret,configured,endpointValid,proxyIdValid,proxySecretValid}=bridgeConfig(env);
  if(!configured||!endpointValid||!proxyIdValid||!proxySecretValid)return {ok:false,provider:PROVIDER,error:"MODAL_BRIDGE_CONFIG_INVALID",secret_echo:false};
  if(!Number.isInteger(n)||n<1||n>100000)return {ok:false,provider:PROVIDER,error:"INVALID_N",allowed_range:[1,100000],secret_echo:false};
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
      route_eligible:false,
      paid_fallback:false,
      free_credit_only:true,
      secret_echo:false,
      acceptance_state:checksumOk?"cpu-e2e-pass-gpu-e2e-required":"cpu-e2e-failed"
    };
  }catch(e){
    return {ok:false,provider:PROVIDER,error:e?.name==="AbortError"?"MODAL_CPU_E2E_TIMEOUT":"MODAL_CPU_E2E_UNAVAILABLE",route_eligible:false,paid_fallback:false,free_credit_only:true,secret_echo:false,acceptance_state:"cpu-e2e-failed"};
  }finally{clearTimeout(timer)}
}

export async function modalGpuSelftest(env,n=10000){
  const {gpuEndpoint,proxyId,proxySecret,configured,endpointValid,proxyIdValid,proxySecretValid}=gpuConfig(env);
  if(!configured)return {ok:false,provider:PROVIDER,error:"MODAL_GPU_ENDPOINT_CONFIG_REQUIRED",gpu_endpoint_configured:Boolean(gpuEndpoint),route_eligible:false,paid_fallback:false,free_credit_only:true,secret_echo:false};
  if(!endpointValid||!proxyIdValid||!proxySecretValid)return {ok:false,provider:PROVIDER,error:"MODAL_GPU_CONFIG_INVALID",route_eligible:false,paid_fallback:false,free_credit_only:true,secret_echo:false};
  if(!Number.isInteger(n)||n<1||n>100000)return {ok:false,provider:PROVIDER,error:"INVALID_N",allowed_range:[1,100000],secret_echo:false};
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
      route_eligible:false,
      paid_fallback:false,
      free_credit_only:true,
      secret_echo:false,
      acceptance_state:gpuOk?"gpu-e2e-pass-awaiting-router-enable":"gpu-e2e-failed"
    };
  }catch(e){
    return {ok:false,provider:PROVIDER,error:e?.name==="AbortError"?"MODAL_GPU_E2E_TIMEOUT":"MODAL_GPU_E2E_UNAVAILABLE",route_eligible:false,paid_fallback:false,free_credit_only:true,secret_echo:false,acceptance_state:"gpu-e2e-failed"};
  }finally{clearTimeout(timer)}
}
