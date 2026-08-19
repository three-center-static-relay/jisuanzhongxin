import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

function safeError(value){return String(value?.message||value||"HUAWEI_CREDENTIAL_CROSSCHECK_FAILED").slice(0,180)}
function parseJson(value){try{return JSON.parse(String(value||"{}"))}catch{return{}}}
function upstreamCode(body){return String(body?.error_code||body?.code||"").slice(0,80)||null}
function upstreamMessage(body){return body?.error_msg||body?.error_message||body?.message||body?.error?.message||""}
function iamRejected(response,code){return response.status===401||code==="APIGW.0301"||code==="APIG.0301"}
function safeAuthDetailClass(message){
  const msg=String(message||"").toLowerCase();
  if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";
  if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";
  if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";
  if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";
  if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";
  return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL";
}

async function probeIamProjectContext({ak,sk,parsed}){
  const url=`https://iam.myhuaweicloud.com/v3/projects?name=${encodeURIComponent(parsed.region)}`;
  const baseHeaders={"content-type":"application/json"};
  const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
  const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
  const body=parseJson(await response.text());
  const code=upstreamCode(body);
  const iamAuthenticated=!iamRejected(response,code);
  const projects=Array.isArray(body?.projects)?body.projects:[];
  const projectContextMatch=iamAuthenticated&&projects.some(project=>String(project?.id||"")===parsed.project_id);
  return{response,body,code,iam_authenticated:iamAuthenticated,project_context_match:projectContextMatch,region_project_found:iamAuthenticated&&projects.length>0,region_project_count:iamAuthenticated?projects.length:0};
}

export async function probeHuaweiDummyAuthTransport(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const region=parsed.ok?parsed.region:"cn-south-4";
  const dummyAk="00000000000000000000";
  const dummySk="0000000000000000000000000000000000000000";
  const url=`https://iam.myhuaweicloud.com/v3/projects?name=${encodeURIComponent(region)}`;
  const baseHeaders={"content-type":"application/json"};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak:dummyAk,sk:dummySk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text());
    const code=upstreamCode(body),message=upstreamMessage(body),detail=safeAuthDetailClass(message);
    return{ok:true,provider:"huawei-dummy-auth-transport",service:"iam",http_status:response.status,upstream_error_code:code,error_class:classifyHuaweiError(code,message),auth_detail_class:detail,authorization_header_recognized:detail!=="X_AUTH_TOKEN_MISSING",used_real_credentials:false,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,provider:"huawei-dummy-auth-transport",service:"iam",http_status:0,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",authorization_header_recognized:null,used_real_credentials:false,route_eligible:false,paid_fallback:false,secret_echo:false,error:safeError(error)}}
}

export async function probeHuaweiCredentialCrosscheck(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",phase:"preflight",http_status:0,authenticated:false,iam_authenticated:false,project_context_match:false,authorized:false,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  try{
    const iam=await probeIamProjectContext({ak,sk,parsed});
    if(!iam.iam_authenticated){
      return{ok:true,configured:true,provider:"huawei-credential-crosscheck",service:"iam",canary:"cts-readonly-auth",phase:"iam-project-discovery",http_status:iam.response.status,authenticated:false,iam_authenticated:false,project_context_match:false,region_project_found:false,region_project_count:0,authorized:false,upstream_error_code:iam.code,error_class:classifyHuaweiError(iam.code,upstreamMessage(iam.body)),auth_detail_class:safeAuthDetailClass(upstreamMessage(iam.body)),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
    }
    if(!iam.project_context_match){
      return{ok:true,configured:true,provider:"huawei-credential-crosscheck",service:"iam",canary:"cts-readonly-auth",phase:"project-context-compare",http_status:iam.response.status,authenticated:false,iam_authenticated:true,project_context_match:false,region_project_found:iam.region_project_found,region_project_count:iam.region_project_count,authorized:false,upstream_error_code:null,error_class:"HUAWEI_PROJECT_CONTEXT_MISMATCH",auth_detail_class:"AUTHENTICATED",region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
    }

    const url=`https://cts.${parsed.region}.myhuaweicloud.com/v3/${parsed.project_id}/trackers`;
    const baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text());
    const code=upstreamCode(body);
    const errorClass=response.ok?null:classifyHuaweiError(code,upstreamMessage(body));
    const ctsAuthenticated=!iamRejected(response,code);
    return{ok:true,configured:true,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",phase:"cts-readonly-auth",http_status:response.status,authenticated:ctsAuthenticated,iam_authenticated:true,project_context_match:true,region_project_found:true,region_project_count:iam.region_project_count,authorized:response.ok,upstream_error_code:code,error_class:errorClass,auth_detail_class:response.ok?"AUTHENTICATED":safeAuthDetailClass(upstreamMessage(body)),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-credential-crosscheck",service:"iam",canary:"cts-readonly-auth",phase:"transport-or-signing",http_status:0,authenticated:false,iam_authenticated:false,project_context_match:false,authorized:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",error:safeError(error),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
