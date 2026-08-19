import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

const EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const DUMMY_AK="00000000000000000000";
const DUMMY_SK="0000000000000000000000000000000000000000";
const parseJson=value=>{try{return JSON.parse(String(value||"{}"))}catch{return{}}};
const codeOf=body=>String(body?.error_code||body?.code||"").slice(0,80)||null;
const messageOf=body=>body?.error_msg||body?.error_message||body?.message||body?.error?.message||"";
function detailClass(message){
  const msg=String(message||"").toLowerCase();
  if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";
  if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";
  if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";
  if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";
  if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";
  return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL";
}
async function one(url,explicitContentHash){
  const baseHeaders={"content-type":"application/json",...(explicitContentHash?{"x-sdk-content-sha256":EMPTY_SHA256}:{})};
  const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak:DUMMY_AK,sk:DUMMY_SK});
  const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
  const body=parseJson(await response.text()),code=codeOf(body),message=messageOf(body),detail=detailClass(message);
  return{http_status:response.status,upstream_error_code:code,error_class:classifyHuaweiError(code,message),auth_detail_class:detail,authorization_header_recognized:detail!=="X_AUTH_TOKEN_MISSING",explicit_content_sha256:explicitContentHash};
}
export async function probeHuaweiDummyPayloadAB(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN),region=parsed.ok?parsed.region:"cn-south-4";
  const url=`https://iam.myhuaweicloud.com/v3/projects?name=${encodeURIComponent(region)}`;
  try{
    const implicit=await one(url,false),explicit=await one(url,true);
    return{ok:true,provider:"huawei-dummy-payload-ab",service:"iam",implicit,explicit,same_auth_detail:implicit.auth_detail_class===explicit.auth_detail_class,same_error_class:implicit.error_class===explicit.error_class,used_real_credentials:false,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch{return{ok:false,provider:"huawei-dummy-payload-ab",service:"iam",used_real_credentials:false,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",route_eligible:false,paid_fallback:false,secret_echo:false}}
}
