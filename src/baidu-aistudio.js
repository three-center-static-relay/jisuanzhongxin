const OFFICIAL_DOCS="https://ai.baidu.com/ai-doc/AISTUDIO/lluckgp2n";
const ACCESS_TOKEN_PAGE="https://aistudio.baidu.com/index/accessToken";
const MODELS_URL="https://aistudio.baidu.com/llm/lmapi/v3/models";

function token(env){
  return String(env.BAIDU_AISTUDIO_ACCESS_TOKEN||"").trim();
}

async function fetchWithTimeout(url,init={},timeoutMs=12000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:c.signal})}
  catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("BAIDU_AISTUDIO_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}

export function baiduAIStudioMeta(){
  return {
    provider:"baidu-aistudio",
    role:"china-general-compute-on-demand",
    auth:"access-token",
    access_token_page:ACCESS_TOKEN_PAGE,
    official_job_control:"aistudio-cli",
    official_docs:OFFICIAL_DOCS,
    token_probe:"official-llm-model-list",
    supported_documented_device:"v100",
    payment_mode:"coupon",
    acoin_allowed:false,
    paid_fallback:false,
    arbitrary_paid_execution:false,
    cloudflare_native_job_api:false,
    unattended_ready:false,
    operational_mode:"on-demand-cli",
    route_eligible:false,
    daily_maintenance_required:false,
    daily_checkin_required:false,
    daily_bonus_optional:true,
    daily_bonus_points:8,
    daily_bonus_requires_project_start:true,
    bonus_harvesting:false
  };
}

export async function probeBaiduAIStudio(env){
  const t=token(env);
  if(!t)return {
    ok:false,
    provider:"baidu-aistudio",
    configured:false,
    token_present:false,
    authenticated:false,
    authentication_tested:false,
    manual_ready:false,
    automation_ready:false,
    dispatch_enabled:false,
    route_eligible:false,
    operational_mode:"on-demand-cli",
    payment_mode:"coupon",
    acoin_allowed:false,
    paid_fallback:false,
    daily_maintenance_required:false,
    daily_checkin_required:false,
    reason:"BAIDU_AISTUDIO_ACCESS_TOKEN_NOT_CONFIGURED",
    secret_echo:false
  };
  try{
    const r=await fetchWithTimeout(MODELS_URL,{method:"GET",headers:{authorization:`Bearer ${t}`,accept:"application/json","user-agent":"three-center-compute/2026-08"}});
    const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch{}
    const models=Array.isArray(j?.data)?j.data.length:null;
    const authenticated=r.ok;
    return {
      ok:authenticated,
      provider:"baidu-aistudio",
      configured:true,
      token_present:true,
      authenticated,
      authentication_tested:true,
      token_probe_http_status:r.status,
      models_visible:models,
      manual_ready:authenticated,
      automation_ready:false,
      dispatch_enabled:false,
      route_eligible:false,
      official_job_control:"aistudio-cli",
      cloudflare_native_job_api:false,
      operational_mode:"on-demand-cli",
      payment_mode:"coupon",
      acoin_allowed:false,
      paid_fallback:false,
      daily_maintenance_required:false,
      daily_checkin_required:false,
      daily_bonus_optional:true,
      daily_bonus_points:8,
      daily_bonus_requires_project_start:true,
      reason:authenticated?"READY_FOR_ON_DEMAND_CLI_USE":`BAIDU_TOKEN_PROBE_HTTP_${r.status}`,
      secret_echo:false
    };
  }catch(e){
    return {
      ok:false,
      provider:"baidu-aistudio",
      configured:true,
      token_present:true,
      authenticated:false,
      authentication_tested:true,
      manual_ready:false,
      automation_ready:false,
      dispatch_enabled:false,
      route_eligible:false,
      official_job_control:"aistudio-cli",
      cloudflare_native_job_api:false,
      operational_mode:"on-demand-cli",
      payment_mode:"coupon",
      acoin_allowed:false,
      paid_fallback:false,
      daily_maintenance_required:false,
      daily_checkin_required:false,
      reason:String(e?.message||"BAIDU_TOKEN_PROBE_FAILED"),
      http_status:Number(e?.status||0)||null,
      secret_echo:false
    };
  }
}
