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
    cpu:true,
    gpu:true,
    paid_fallback:false,
    free_credit_only:true,
    arbitrary_code_route:false,
    route_eligible:false,
    acceptance_state:"registered-awaiting-credentials-and-live-e2e"
  };
}

export function modalHealth(env){
  const tokenId=String(env.MODAL_TOKEN_ID||"").trim();
  const tokenSecret=String(env.MODAL_TOKEN_SECRET||"").trim();
  const configured=Boolean(tokenId&&tokenSecret);
  return {
    ok:configured,
    provider:PROVIDER,
    configured,
    token_id_configured:Boolean(tokenId),
    token_secret_configured:Boolean(tokenSecret),
    authenticated:false,
    live_probe:false,
    route_eligible:false,
    paid_fallback:false,
    free_credit_only:true,
    acceptance_state:configured?"credentials-present-awaiting-live-e2e":"credentials-required",
    secret_echo:false
  };
}
