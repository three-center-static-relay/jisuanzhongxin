import {createHash,createHmac} from "node:crypto";
import {classifyHuaweiError,parseHuaweiFunctionUrn} from "./huawei-functiongraph.js";

const EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const parseJson=value=>{try{return JSON.parse(String(value||"{}"))}catch{return{}}};
const codeOf=body=>String(body?.error_code||body?.code||"").slice(0,80)||null;
const messageOf=body=>body?.error_msg||body?.error_message||body?.errorMessage||body?.message||body?.error?.message||"";
function detailClass(message){const msg=String(message||"").toLowerCase();if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL"}
function stamp(date=new Date()){return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
function signDateOnly({method,url,ak,sk,date=new Date()}){
  const target=new URL(url),xSdkDate=stamp(date);
  const path=target.pathname.endsWith("/")?target.pathname:`${target.pathname}/`;
  const canonicalRequest=[String(method).toUpperCase(),path,"",`x-sdk-date:${xSdkDate}\n`,"x-sdk-date",EMPTY_SHA256].join("\n");
  const requestHash=createHash("sha256").update(canonicalRequest).digest("hex");
  const stringToSign=["SDK-HMAC-SHA256",xSdkDate,requestHash].join("\n");
  const signature=createHmac("sha256",sk).update(stringToSign).digest("hex");
  return{x_sdk_date:xSdkDate,authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=x-sdk-date, Signature=${signature}`};
}
export async function probeHuaweiDateOnlySignature(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN),ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-date-only-signature",http_status:0,authenticated:false,auth_detail_class:"PREFLIGHT_FAILED",signed_headers_mode:"x-sdk-date",query_mode:"none",route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions`;
  try{
    const signed=signDateOnly({method:"GET",url,ak,sk});
    const response=await fetch(url,{method:"GET",headers:{"content-type":"application/json","x-project-id":parsed.project_id,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text()),code=codeOf(body),message=messageOf(body),rejected=response.status===401||code==="APIGW.0301"||code==="APIG.0301";
    return{ok:!rejected,configured:true,provider:"huawei-date-only-signature",http_status:response.status,authenticated:!rejected,authorized:response.ok,upstream_error_code:code,error_class:response.ok?null:classifyHuaweiError(code,message),auth_detail_class:response.ok?"AUTHENTICATED":detailClass(message),signed_headers_mode:"x-sdk-date",query_mode:"none",upstream_called:true,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch{return{ok:false,configured:true,provider:"huawei-date-only-signature",http_status:0,authenticated:false,authorized:false,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",signed_headers_mode:"x-sdk-date",query_mode:"none",upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
