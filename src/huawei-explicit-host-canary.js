import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

const parseJson=value=>{try{return JSON.parse(String(value||"{}"))}catch{return{}}};
const codeOf=body=>String(body?.error_code||body?.code||"").slice(0,80)||null;
const messageOf=body=>body?.error_msg||body?.error_message||body?.errorMessage||body?.message||body?.error?.message||"";
function detailClass(message){
  const msg=String(message||"").toLowerCase();
  if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";
  if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";
  if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";
  if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";
  if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";
  return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL";
}

export async function probeHuaweiExplicitHost(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-explicit-host",http_status:0,authenticated:false,auth_detail_class:"PREFLIGHT_FAILED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions`;
  const target=new URL(url);
  const baseHeaders={"content-type":"application/json","host":target.host,"x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization},redirect:"manual"});
    const body=parseJson(await response.text()),code=codeOf(body),message=messageOf(body);
    const rejected=response.status===401||code==="APIGW.0301"||code==="APIG.0301";
    return{ok:!rejected,configured:true,provider:"huawei-explicit-host",http_status:response.status,authenticated:!rejected,authorized:response.ok,upstream_error_code:code,error_class:response.ok?null:classifyHuaweiError(code,message),auth_detail_class:response.ok?"AUTHENTICATED":detailClass(message),explicit_host_sent:true,signed_headers:signed.signed_headers,query_mode:"none",upstream_called:true,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-explicit-host",http_status:0,authenticated:false,authorized:false,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",explicit_host_sent:true,query_mode:"none",upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false,error_name:String(error?.name||"Error")}};
}
