const OFFICIAL_DOCS="https://ai.baidu.com/ai-doc/AISTUDIO/lluckgp2n";
const ACCESS_TOKEN_PAGE="https://aistudio.baidu.com/index/accessToken";

function configured(env){
  return Boolean(String(env.BAIDU_AISTUDIO_ACCESS_TOKEN||"").trim());
}

export function baiduAIStudioMeta(){
  return {
    provider:"baidu-aistudio",
    role:"china-general-compute-candidate",
    auth:"access-token",
    access_token_page:ACCESS_TOKEN_PAGE,
    official_job_control:"aistudio-cli",
    official_docs:OFFICIAL_DOCS,
    supported_documented_device:"v100",
    payment_mode:"coupon",
    acoin_allowed:false,
    paid_fallback:false,
    arbitrary_paid_execution:false,
    cloudflare_native_job_api:false,
    unattended_ready:false,
    daily_checkin_required:false,
    bonus_harvesting:false
  };
}

export function probeBaiduAIStudio(env){
  const hasToken=configured(env);
  return {
    ok:false,
    provider:"baidu-aistudio",
    configured:hasToken,
    token_present:hasToken,
    authenticated:false,
    authentication_tested:false,
    official_job_control:"aistudio-cli",
    cloudflare_native_job_api:false,
    automation_ready:false,
    dispatch_enabled:false,
    payment_mode:"coupon",
    acoin_allowed:false,
    paid_fallback:false,
    reason:hasToken?"OFFICIAL_BACKGROUND_JOB_CONTROL_IS_CLI_ONLY":"BAIDU_AISTUDIO_ACCESS_TOKEN_NOT_CONFIGURED",
    secret_echo:false
  };
}
