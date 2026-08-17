const API="https://modelscope.cn/openapi/v1";
const TIMEOUT_MS=15000;
const str=v=>String(v??"").trim();

export const MODELSCOPE_RUNTIME_REQUIREMENTS=Object.freeze({
  schema:"modelscope-free-cpu-runtime-baseline-v1-20260817",
  free_only:true,
  minimum_cpu_cores:8,
  minimum_memory_gb:30,
  minimum_os:"ubuntu",
  minimum_os_version:"22.04",
  minimum_python:"3.12",
  minimum_torch:"2.3",
  preferred_current_image:"ubuntu22.04-py312-torch2.3.1-1.39.0",
  upgrade_policy:"candidate-canary-promote",
  keep_last_verified_until_candidate_pass:true,
  alert_on:["FREE_CPU_REMOVED","BILLING_REQUIRED","RUNTIME_BASELINE_NOT_MET","AUTH_REQUIRES_HUMAN","TERMS_OR_REALNAME_ACTION_REQUIRED"],
  note:"Newer compatible images are allowed; version drift alone is not a failure. Production promotion requires a bounded runtime attestation/E2E."
});

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
  const freeText=JSON.stringify(freeObjects).toLowerCase();
  return {
    hardware_objects_seen:objects.length,
    explicit_free_hardware_seen:freeObjects.length,
    explicit_free_hardware_labels:[...new Set(labels)],
    explicit_free_cpu_seen:/cpu|处理器|核/.test(freeText),
    explicit_free_gpu_seen:/gpu|cuda|rocm|显卡/.test(freeText)
  };
}

function versionTuple(v){return str(v).match(/\d+(?:\.\d+){0,2}/)?.[0].split(".").map(Number)||[]}
function versionAtLeast(actual,minimum){const a=versionTuple(actual),b=versionTuple(minimum);if(!a.length)return false;for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x>y)return true;if(x<y)return false}return true}

export function evaluateModelScopeRuntime(attestation={}){
  if(!attestation||Object.keys(attestation).length===0)return {verified:false,compatible:null,user_action_required:false,alerts:["RUNTIME_ATTESTATION_REQUIRED_BEFORE_PRODUCTION"],checks:[]};
  const checks=[
    {id:"free",ok:attestation.free===true||attestation.billing_mode==="free"},
    {id:"cpu",ok:Number(attestation.cpu_cores)>=MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_cpu_cores},
    {id:"memory",ok:Number(attestation.memory_gb)>=MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_memory_gb},
    {id:"os",ok:str(attestation.os_name).toLowerCase().includes(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_os)&&versionAtLeast(attestation.os_version,MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_os_version)},
    {id:"python",ok:versionAtLeast(attestation.python_version,MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_python)},
    {id:"torch",ok:versionAtLeast(attestation.torch_version,MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_torch)}
  ];
  const failed=checks.filter(x=>!x.ok).map(x=>x.id),compatible=failed.length===0;
  const alerts=[];
  if(failed.includes("free"))alerts.push("BILLING_REQUIRED");
  if(failed.some(x=>x!=="free"))alerts.push("RUNTIME_BASELINE_NOT_MET");
  return {verified:true,compatible,user_action_required:alerts.length>0,alerts,failed_checks:failed,checks};
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
  acceptance_state:"token-and-free-hardware-and-runtime-e2e-required",
  runtime_requirements:MODELSCOPE_RUNTIME_REQUIREMENTS
}}

export async function probeModelScope(env={}){
  const configured=Boolean(token(env));
  if(!configured)return {ok:false,provider:"modelscope",configured:false,authenticated:false,free_only:true,route_eligible:false,acceptance_state:"token-required",user_action_required:true,alerts:["AUTH_REQUIRES_HUMAN"],secret_echo:false};
  try{
    const me=await getJson(env,"/users/me");
    const hardware=await getJson(env,"/studios/hardware");
    const hs=summarizeHardware(hardware);
    const authenticated=Boolean(me&&typeof me==="object");
    const freeHardwareVerified=hs.explicit_free_hardware_seen>0;
    const freeCpuVerified=freeHardwareVerified&&(hs.explicit_free_cpu_seen||hs.explicit_free_hardware_labels.length>0);
    const alerts=[];
    if(!freeHardwareVerified)alerts.push("FREE_CPU_NOT_EXPLICITLY_VERIFIED");
    alerts.push("RUNTIME_ATTESTATION_REQUIRED_BEFORE_PRODUCTION");
    return {ok:authenticated,provider:"modelscope",configured:true,authenticated,hardware_discovery_ok:true,...hs,free_hardware_verified:freeHardwareVerified,free_cpu_verified:freeCpuVerified,free_only:true,daily_manual_claim_required:false,initial_manual_activation_may_be_required:true,automatic_paid_upgrade:false,paid_fallback:false,current_runtime_e2e_verified:false,route_eligible:false,acceptance_state:freeHardwareVerified?"free-hardware-visible-runtime-e2e-required":"authenticated-free-hardware-not-explicitly-verified",user_action_required:false,alerts,runtime_requirements:MODELSCOPE_RUNTIME_REQUIREMENTS,secret_echo:false};
  }catch(e){
    const status=Number(e?.status||0)||null;
    const auth=status===401||status===403;
    return {ok:false,provider:"modelscope",configured:true,authenticated:false,hardware_discovery_ok:false,free_hardware_verified:false,free_cpu_verified:false,free_only:true,route_eligible:false,error_class:str(e?.message)||"MODELSCOPE_PROBE_FAILED",http_status:status,acceptance_state:auth?"auth-requires-human":"live-health-failed",user_action_required:auth,alerts:[auth?"AUTH_REQUIRES_HUMAN":"CONTROL_PLANE_PROBE_FAILED"],runtime_requirements:MODELSCOPE_RUNTIME_REQUIREMENTS,secret_echo:false};
  }
}

export function planModelScopeRoute(input={}){
  const gpu=Boolean(input?.gpu);
  return {provider:"modelscope",requested_accelerator:gpu?"gpu":"cpu",free_only:true,paid_fallback:false,automatic_paid_upgrade:false,execution_started:false,route_eligible:false,reason:"runtime-e2e-not-yet-accepted",next_requirement:"configure token, verify free hardware, then complete bounded Studio/Notebook runtime E2E",runtime_requirements:MODELSCOPE_RUNTIME_REQUIREMENTS};
}
