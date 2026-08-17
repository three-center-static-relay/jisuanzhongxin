const API="https://modelscope.cn/openapi/v1";
const TIMEOUT_MS=15000;
const str=v=>String(v??"").trim();

function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}
function authHeaders(env={}){const t=token(env);return t?{authorization:`Bearer ${t}`,accept:"application/json"}:{accept:"application/json"}}
async function getJson(env,path){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(`${API}${path}`,{method:"GET",headers:authHeaders(env),signal:controller.signal});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok){const e=new Error(`MODELSCOPE_HTTP_${r.status}`);e.status=r.status;e.details=data;throw e}
    return data;
  }catch(e){if(e?.name==="AbortError"){const x=new Error("MODELSCOPE_TIMEOUT");x.status=504;throw x}throw e}
  finally{clearTimeout(timer)}
}

function flatten(value,out=[]){
  if(Array.isArray(value)){for(const x of value)flatten(x,out);return out}
  if(value&&typeof value==="object"){out.push(value);for(const x of Object.values(value))flatten(x,out)}
  return out;
}
function looksFree(o={}){
  const text=JSON.stringify(o).toLowerCase();
  if(/"(free|is_free|free_tier|freequota|free_quota)"\s*:\s*(true|1|"true")/.test(text))return true;
  if(/"(price|cost|hourly_price|unit_price)"\s*:\s*(0|0\.0+|"0"|"0\.0+")/.test(text))return true;
  if(/免费|free tier|free quota|free gpu|free cpu/.test(text))return true;
  return false;
}
function summarizeHardware(data){
  const objects=flatten(data,[]);
  const freeObjects=objects.filter(looksFree);
  const labels=freeObjects.map(o=>str(o.name||o.label||o.id||o.sku||o.resource_name||o.instance_type)).filter(Boolean).slice(0,12);
  return {hardware_objects_seen:objects.length,explicit_free_hardware_seen:freeObjects.length,explicit_free_hardware_labels:[...new Set(labels)]};
}

export function modelscopeMeta(){return{
  provider:"modelscope",
  region_role:"china-secondary-compute",
  integration:"official-ModelScope-OpenAPI-v1",
  api_base:API,
  auth:"bearer-token",
  accepted_secret_vars:["MODELSCOPE_API_TOKEN","MODELSCOPE_TOKEN"],
  notebook_registered_user_free:true,
  gpu_policy:"quota-based-not-unlimited",
  daily_manual_claim_required:false,
  initial_manual_activation_may_be_required:true,
  current_amd_incentive_end:"2026-12-31",
  automatic_paid_upgrade:false,
  paid_fallback:false,
  free_only:true,
  arbitrary_code:false,
  arbitrary_shell:false,
  execution_mode:"candidate-readiness-only-until-free-runtime-e2e",
  route_eligible:false,
  acceptance_state:"token-and-free-hardware-and-runtime-e2e-required"
}}

export async function probeModelScope(env={}){
  const configured=Boolean(token(env));
  if(!configured)return {ok:false,provider:"modelscope",configured:false,authenticated:false,free_only:true,route_eligible:false,acceptance_state:"token-required",secret_echo:false};
  try{
    const me=await getJson(env,"/users/me");
    const hardware=await getJson(env,"/studios/hardware");
    const hs=summarizeHardware(hardware);
    const authenticated=Boolean(me&&typeof me==="object");
    const freeHardwareVerified=hs.explicit_free_hardware_seen>0;
    return {ok:authenticated,provider:"modelscope",configured:true,authenticated,hardware_discovery_ok:true,...hs,free_hardware_verified:freeHardwareVerified,free_only:true,daily_manual_claim_required:false,initial_manual_activation_may_be_required:true,automatic_paid_upgrade:false,paid_fallback:false,current_runtime_e2e_verified:false,route_eligible:false,acceptance_state:freeHardwareVerified?"free-hardware-visible-runtime-e2e-required":"authenticated-free-hardware-not-explicitly-verified",secret_echo:false};
  }catch(e){return {ok:false,provider:"modelscope",configured:true,authenticated:false,hardware_discovery_ok:false,free_hardware_verified:false,free_only:true,route_eligible:false,error_class:str(e?.message)||"MODELSCOPE_PROBE_FAILED",http_status:Number(e?.status||0)||null,acceptance_state:"live-health-failed",secret_echo:false}}
}

export function planModelScopeRoute(input={}){
  const gpu=Boolean(input?.gpu);
  return {provider:"modelscope",requested_accelerator:gpu?"gpu":"cpu",free_only:true,paid_fallback:false,automatic_paid_upgrade:false,execution_started:false,route_eligible:false,reason:"runtime-e2e-not-yet-accepted",next_requirement:"configure token, verify free hardware, then complete bounded Studio/Notebook runtime E2E"};
}
