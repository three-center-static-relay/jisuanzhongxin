import {ModalClient} from "modal";

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
    token_id_env:"MODAL_TOKEN_ID",
    token_secret_env:"MODAL_TOKEN_SECRET",
    authentication:"modal-api-token-pair",
    official_sdk:true,
    official_sdk_version:"0.9.0",
    cpu:true,
    gpu:true,
    paid_fallback:false,
    free_credit_only:true,
    arbitrary_code_route:false,
    route_eligible:false,
    acceptance_state:"registered-awaiting-live-auth-and-compute-e2e"
  };
}

function baseHealth(env){
  const tokenId=String(env.MODAL_TOKEN_ID||"").trim();
  const tokenSecret=String(env.MODAL_TOKEN_SECRET||"").trim();
  const tokenIdFormatOk=/^ak-[A-Za-z0-9_-]+$/.test(tokenId);
  const tokenSecretFormatOk=/^as-[A-Za-z0-9_-]+$/.test(tokenSecret);
  return {tokenId,tokenSecret,configured:Boolean(tokenId&&tokenSecret),tokenIdFormatOk,tokenSecretFormatOk};
}

function grpcCodeName(code){
  const n=Number(code);
  return ({0:"OK",1:"CANCELLED",2:"UNKNOWN",3:"INVALID_ARGUMENT",4:"DEADLINE_EXCEEDED",5:"NOT_FOUND",6:"ALREADY_EXISTS",7:"PERMISSION_DENIED",8:"RESOURCE_EXHAUSTED",9:"FAILED_PRECONDITION",10:"ABORTED",11:"OUT_OF_RANGE",12:"UNIMPLEMENTED",13:"INTERNAL",14:"UNAVAILABLE",15:"DATA_LOSS",16:"UNAUTHENTICATED"})[n]||"UNRECOGNIZED";
}

function classifyModalError(e){
  const code=Number.isFinite(Number(e?.code))?Number(e.code):null;
  if(code===16)return"MODAL_UNAUTHENTICATED";
  if(code===7)return"MODAL_PERMISSION_DENIED";
  if(code===8)return"MODAL_RESOURCE_EXHAUSTED";
  if(code===14)return"MODAL_SERVICE_UNAVAILABLE";
  if(code===4)return"MODAL_AUTH_TIMEOUT";
  const s=String(e?.message||e||"").toLowerCase();
  if(s.includes("unauth")||s.includes("permission")||s.includes("credential")||s.includes("token"))return"MODAL_AUTH_FAILED";
  if(s.includes("timeout")||s.includes("deadline"))return"MODAL_AUTH_TIMEOUT";
  if(s.includes("fetch")||s.includes("network")||s.includes("connect")||s.includes("grpc"))return"MODAL_NETWORK_OR_TRANSPORT_FAILED";
  return"MODAL_LIVE_PROBE_FAILED";
}

export async function modalHealth(env){
  const {tokenId,tokenSecret,configured,tokenIdFormatOk,tokenSecretFormatOk}=baseHealth(env);
  const format={token_id_format_ok:tokenIdFormatOk,token_secret_format_ok:tokenSecretFormatOk};
  if(!configured)return {
    ok:false,provider:PROVIDER,configured:false,
    token_id_configured:Boolean(tokenId),token_secret_configured:Boolean(tokenSecret),...format,
    authenticated:false,live_probe:false,route_eligible:false,paid_fallback:false,free_credit_only:true,
    acceptance_state:"credentials-required",secret_echo:false
  };
  if(!tokenIdFormatOk||!tokenSecretFormatOk)return {
    ok:false,provider:PROVIDER,configured:true,
    token_id_configured:true,token_secret_configured:true,...format,
    authenticated:false,live_probe:false,error_class:"MODAL_CREDENTIAL_FORMAT_INVALID",
    route_eligible:false,paid_fallback:false,free_credit_only:true,
    acceptance_state:"credential-format-invalid",secret_echo:false
  };
  let client;
  try{
    client=new ModalClient({tokenId,tokenSecret,timeoutMs:8000,maxRetries:0,maxThrottleWaitSecs:0});
    const builderVersion=await client.getImageBuilderVersion();
    return {
      ok:true,provider:PROVIDER,configured:true,
      token_id_configured:true,token_secret_configured:true,...format,
      authenticated:true,live_probe:true,image_builder_version_present:Boolean(builderVersion),
      route_eligible:false,paid_fallback:false,free_credit_only:true,
      acceptance_state:"authenticated-awaiting-minimal-compute-e2e",secret_echo:false
    };
  }catch(e){
    const grpcCode=Number.isFinite(Number(e?.code))?Number(e.code):null;
    return {
      ok:false,provider:PROVIDER,configured:true,
      token_id_configured:true,token_secret_configured:true,...format,
      authenticated:false,live_probe:true,error_class:classifyModalError(e),
      error_name:String(e?.name||"Error").replace(/[^A-Za-z0-9_.-]/g,"").slice(0,80),
      grpc_code:grpcCode,grpc_code_name:grpcCode===null?null:grpcCodeName(grpcCode),
      route_eligible:false,paid_fallback:false,free_credit_only:true,
      acceptance_state:"live-auth-failed",secret_echo:false
    };
  }finally{
    try{client?.close()}catch{}
  }
}
