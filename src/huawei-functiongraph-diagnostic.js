import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

function safeError(value){return String(value?.message||value||"HUAWEI_AK_CONTROL_FAILED").slice(0,180)}
export function mutateHuaweiAkForControl(value){
  const ak=String(value||"").trim();
  if(!ak)return"";
  const replacement=ak[0]==="A"?"B":"A";
  return `${replacement}${ak.slice(1)}`;
}

export async function probeHuaweiAkExistenceControl(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const realAk=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!realAk||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-functiongraph",canary:"mutated-ak-control",http_status:0,control_ak_mutated:false,control_ak_not_found:false,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const controlAk=mutateHuaweiAkForControl(realAk);
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions?maxitems=1`;
  const baseHeaders={"content-type":"application/json"};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak:controlAk,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const text=await response.text();
    let body={};try{body=JSON.parse(text||"{}")}catch{}
    const upstreamErrorCode=String(body?.error_code||"").slice(0,80)||null;
    const errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,body?.error_msg);
    return{ok:true,configured:true,provider:"huawei-functiongraph",canary:"mutated-ak-control",http_status:response.status,control_ak_mutated:true,control_ak_not_found:errorClass==="HUAWEI_AK_NOT_FOUND",upstream_error_code:upstreamErrorCode,error_class:errorClass,region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph",canary:"mutated-ak-control",http_status:0,control_ak_mutated:true,control_ak_not_found:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
