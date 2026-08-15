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
    proxy_token_id_env:"MODAL_PROXY_TOKEN_ID",
    proxy_token_secret_env:"MODAL_PROXY_TOKEN_SECRET",
    runtime_transport:"https-web-function",
    direct_cloudflare_sdk_supported:false,
    direct_cloudflare_sdk_reason:"modal-js-uses-node-grpc-http2; Cloudflare Workers node:http2 is a non-functional compatibility stub",
    bridge_required:true,
    cpu:true,
    gpu:true,
    paid_fallback:false,
    free_credit_only:true,
    arbitrary_code_route:false,
    route_eligible:false,
    acceptance_state:"https-bridge-required"
  };
}

function cleanBaseUrl(v){return String(v||"").trim().replace(/\/+$/g,"")}
function validHttpsUrl(v){try{const u=new URL(v);return u.protocol==="https:"}catch{return false}}

export async function modalHealth(env){
  const apiId=String(env.MODAL_TOKEN_ID||"").trim();
  const apiSecret=String(env.MODAL_TOKEN_SECRET||"").trim();
  const endpoint=cleanBaseUrl(env.MODAL_ENDPOINT_URL);
  const proxyId=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const proxySecret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  const apiPairConfigured=Boolean(apiId&&apiSecret);
  const bridgeConfigured=Boolean(endpoint&&proxyId&&proxySecret);
  const modalBindingNames=Object.keys(env||{}).filter((k)=>String(k).startsWith("MODAL_")).sort();
  const base={
    provider:PROVIDER,
    modal_binding_names:modalBindingNames,
    api_token_pair_configured:apiPairConfigured,
    api_token_id_format_ok:apiId?(/^ak-[A-Za-z0-9_-]+$/.test(apiId)):false,
    api_token_secret_format_ok:apiSecret?(/^as-[A-Za-z0-9_-]+$/.test(apiSecret)):false,
    direct_cloudflare_sdk_supported:false,
    bridge_required:true,
    endpoint_configured:Boolean(endpoint),
    proxy_token_id_configured:Boolean(proxyId),
    proxy_token_secret_configured:Boolean(proxySecret),
    proxy_token_id_format_ok:proxyId?(/^wk-[A-Za-z0-9_-]+$/.test(proxyId)):false,
    proxy_token_secret_format_ok:proxySecret?(/^ws-[A-Za-z0-9_-]+$/.test(proxySecret)):false,
    paid_fallback:false,
    free_credit_only:true,
    route_eligible:false,
    secret_echo:false
  };
  if(!bridgeConfigured)return {ok:false,...base,authenticated:false,live_probe:false,acceptance_state:"https-bridge-config-required"};
  if(!validHttpsUrl(endpoint)||!/^wk-[A-Za-z0-9_-]+$/.test(proxyId)||!/^ws-[A-Za-z0-9_-]+$/.test(proxySecret))return {ok:false,...base,authenticated:false,live_probe:false,error_class:"MODAL_BRIDGE_CONFIG_INVALID",acceptance_state:"https-bridge-config-invalid"};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch(`${endpoint}/health`,{method:"GET",headers:{"Modal-Key":proxyId,"Modal-Secret":proxySecret,"Accept":"application/json"},signal:controller.signal});
    const ok=r.ok;
    return {ok,...base,authenticated:ok,live_probe:true,http_status:r.status,acceptance_state:ok?"https-bridge-authenticated-awaiting-compute-e2e":"https-bridge-health-failed"};
  }catch(e){
    return {ok:false,...base,authenticated:false,live_probe:true,error_class:e?.name==="AbortError"?"MODAL_BRIDGE_TIMEOUT":"MODAL_BRIDGE_UNAVAILABLE",acceptance_state:"https-bridge-health-failed"};
  }finally{clearTimeout(timer)}
}
