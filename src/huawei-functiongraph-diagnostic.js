import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

function safeError(value){return String(value?.message||value||"HUAWEI_CREDENTIAL_CROSSCHECK_FAILED").slice(0,180)}
function parseJson(value){try{return JSON.parse(String(value||"{}"))}catch{return{}}}
function errorCode(body){return String(body?.error_code||body?.code||"").slice(0,80)||null}
function errorMessage(body){return String(body?.error_msg||body?.errorMessage||body?.message||"")}
function projectForRegion(body,region){
  const projects=Array.isArray(body?.projects)?body.projects:[];
  const exact=projects.filter(item=>String(item?.name||"")===region&&String(item?.id||""));
  return exact.length===1?String(exact[0].id):"";
}

export async function probeHuaweiIamIdentity(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-iam-identity",service:"iam",canary:"iam-list-projects-auth",http_status:0,authenticated:false,authorized:false,project_context_match:null,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://iam.myhuaweicloud.com/v3/projects?name=${encodeURIComponent(parsed.region)}`;
  const baseHeaders={"content-type":"application/json"};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text());
    const upstreamErrorCode=errorCode(body);
    const iamAuthCode=upstreamErrorCode==="APIGW.0301"||upstreamErrorCode==="APIG.0301";
    const authenticated=response.status!==401&&!iamAuthCode;
    const resolvedProjectId=response.ok?projectForRegion(body,parsed.region):"";
    const projectContextMatch=resolvedProjectId?resolvedProjectId===parsed.project_id:null;
    const errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,errorMessage(body));
    return{ok:authenticated,configured:true,provider:"huawei-iam-identity",service:"iam",canary:"iam-list-projects-auth",http_status:response.status,authenticated,authorized:response.ok,resolved_project_present:Boolean(resolvedProjectId),project_context_match:projectContextMatch,upstream_error_code:upstreamErrorCode,error_class:errorClass,region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-iam-identity",service:"iam",canary:"iam-list-projects-auth",http_status:0,authenticated:false,authorized:false,resolved_project_present:false,project_context_match:null,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false}}
}

export async function probeHuaweiCredentialCrosscheck(env={}){
  const identity=await probeHuaweiIamIdentity(env);
  if(!identity.configured)return{...identity,ok:false,provider:"huawei-credential-crosscheck",service:"cts",canary:"cts-readonly-auth",stage:"preflight",iam_authenticated:false,cts_attempted:false};
  if(!identity.authenticated)return{...identity,ok:false,provider:"huawei-credential-crosscheck",canary:"iam-first-credential-crosscheck",stage:"iam-identity",iam_authenticated:false,cts_attempted:false};
  if(identity.project_context_match===false)return{ok:false,configured:true,provider:"huawei-credential-crosscheck",service:"iam",canary:"iam-first-credential-crosscheck",stage:"project-context",http_status:identity.http_status,authenticated:false,authorized:false,iam_authenticated:true,resolved_project_present:true,project_context_match:false,cts_attempted:false,error_class:"HUAWEI_PROJECT_CONTEXT_MISMATCH",region:identity.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  if(identity.project_context_match!==true)return{ok:false,configured:true,provider:"huawei-credential-crosscheck",service:"iam",canary:"iam-first-credential-crosscheck",stage:"project-context",http_status:identity.http_status,authenticated:false,authorized:false,iam_authenticated:true,resolved_project_present:false,project_context_match:null,cts_attempted:false,error_class:"HUAWEI_PROJECT_CONTEXT_UNRESOLVED",region:identity.region,route_eligible:false,paid_fallback:false,secret_echo:false};

  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  const url=`https://cts.${parsed.region}.myhuaweicloud.com/v3/${parsed.project_id}/trackers`;
  const baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const body=parseJson(await response.text());
    const upstreamErrorCode=errorCode(body);
    const iamAuthCode=upstreamErrorCode==="APIGW.0301"||upstreamErrorCode==="APIG.0301";
    const authenticated=response.status!==401&&!iamAuthCode;
    const errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,errorMessage(body));
    return{ok:authenticated,configured:true,provider:"huawei-credential-crosscheck",service:"cts",canary:"iam-first-credential-crosscheck",stage:"cts-readonly-auth",http_status:response.status,authenticated,authorized:response.ok,iam_authenticated:true,resolved_project_present:true,project_context_match:true,cts_attempted:true,upstream_error_code:upstreamErrorCode,error_class:errorClass,region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-credential-crosscheck",service:"cts",canary:"iam-first-credential-crosscheck",stage:"cts-readonly-auth",http_status:0,authenticated:false,authorized:false,iam_authenticated:true,resolved_project_present:true,project_context_match:true,cts_attempted:true,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),region:parsed.region,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
