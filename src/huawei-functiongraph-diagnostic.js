import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

function safeError(value){return String(value?.message||value||"HUAWEI_CREDENTIAL_CROSSCHECK_FAILED").slice(0,180)}
function parseJson(value){try{return JSON.parse(String(value||"{}"))}catch{return{}}}

export async function probeHuaweiCredentialCrosscheck(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",http_status:0,authenticated:false,authorized:false,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://cts.${parsed.region}.myhuaweicloud.com/v3/${parsed.project_id}/trackers`;
  const baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text());
    const upstreamErrorCode=String(body?.error_code||body?.code||"").slice(0,80)||null;
    const errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,body?.error_msg||body?.message);
    const iamAuthCode=upstreamErrorCode==="APIGW.0301"||upstreamErrorCode==="APIG.0301";
    const authenticated=response.status!==401&&!iamAuthCode;
    return{ok:true,configured:true,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",http_status:response.status,authenticated,authorized:response.ok,upstream_error_code:upstreamErrorCode,error_class:errorClass,region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",http_status:0,authenticated:false,authorized:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
