const encoder=new TextEncoder();
const NO_STORE={"cache-control":"no-store"};
const SELFTEST_MARKER="compute-worker-huawei-functiongraph-v1";
const PRODUCTION_ACCEPTANCE="2026-08-20-live-echo-e2e-pass";

const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
async function sha256Hex(value){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
async function hmacSha256Hex(secret,value){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
function sdkEncode(value){return encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}
function canonicalUri(pathname){const value=String(pathname||"/").split("/").map(sdkEncode).join("/");return value.endsWith("/")?value:`${value}/`}
function canonicalQuery(target){const keys=[...new Set(target.searchParams.keys())].sort(),parts=[];for(const key of keys){const values=target.searchParams.getAll(key).sort();for(const value of values)parts.push(`${sdkEncode(key)}=${sdkEncode(value)}`)}return parts.join("&")}
function sdkDate(date=new Date()){return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
function normalizeHeaderValue(value){return String(value??"").trim().replace(/\s+/g," ")}
function canonicalHeaders(headers){return Object.entries(headers).map(([key,value])=>[key.toLowerCase(),normalizeHeaderValue(value)]).sort((a,b)=>a[0].localeCompare(b[0]))}

export function parseHuaweiFunctionUrn(value){
  const urn=String(value||"").trim(),parts=urn.split(":");
  const valid=parts.length>=7&&parts[0]==="urn"&&parts[1]==="fss"&&/^[a-z0-9-]+$/.test(parts[2]||"")&&/^[A-Za-z0-9]{32}$/.test(parts[3]||"")&&parts[4]==="function"&&/^[A-Za-z0-9_-]+$/.test(parts[5]||"")&&/^[A-Za-z0-9_-]+$/.test(parts[6]||"");
  if(!valid)return{ok:false,error:"INVALID_HUAWEI_FUNCTION_URN",urn:null,region:null,project_id:null,package_name:null,function_name:null};
  return{ok:true,urn,region:parts[2],project_id:parts[3],package_name:parts[5],function_name:parts[6],qualifier:parts.length>7?parts.slice(7).join(":"):null};
}

export async function signHuaweiRequest({method="POST",url,headers={},body="",ak,sk,date=new Date()}){
  const target=new URL(url),xSdkDate=sdkDate(date),signingHeaders={...headers,host:target.host,"x-sdk-date":xSdkDate};
  const ordered=canonicalHeaders(signingHeaders),signedHeaderNames=ordered.map(([key])=>key).join(";"),canonicalHeaderBlock=ordered.map(([key,value])=>`${key}:${value}\n`).join("");
  const payloadHash=await sha256Hex(body||""),request=[String(method).toUpperCase(),canonicalUri(target.pathname),canonicalQuery(target),canonicalHeaderBlock,signedHeaderNames,payloadHash].join("\n"),requestHash=await sha256Hex(request),stringToSign=["SDK-HMAC-SHA256",xSdkDate,requestHash].join("\n"),signature=await hmacSha256Hex(sk,stringToSign);
  return{authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,x_sdk_date:xSdkDate,signed_headers:signedHeaderNames};
}

export async function huaweiSignerSelftest(){
  const project="0123456789abcdef0123456789abcdef",urn=`urn:fss:cn-south-4:${project}:function:default:test1:latest`,url=`https://functiongraph.cn-south-4.myhuaweicloud.com/v2/${project}/fgs/functions/${urn}/invocations`,date=new Date("2026-08-19T09:00:00.000Z");
  const signed=await signHuaweiRequest({method:"POST",url,headers:{"content-type":"application/json","x-cff-request-version":"v1","x-project-id":project},body:'{"selftest":"ok"}',ak:"AK_TEST",sk:"SK_TEST",date});
  const expectedSignature="aa4fdf80a72d8f9617df86931251850c4034d7b88f2c94c512fe6c96908695b1",actualSignature=String(signed.authorization||"").split("Signature=")[1]||"";
  const querySigned=await signHuaweiRequest({method:"GET",url:"https://iam.myhuaweicloud.com/v3/projects?z=hello%20world&a=2&a=1",headers:{"content-type":"application/json"},body:"",ak:"AK_TEST",sk:"SK_TEST",date});
  const querySignature=String(querySigned.authorization||"").split("Signature=")[1]||"",canonicalQueryParity=querySignature==="213c015c1010d2a59dfd7b6880d35239bf297b408306283f689929f0410ee1ee";
  const ok=signed.x_sdk_date==="20260819T090000Z"&&signed.signed_headers==="content-type;host;x-cff-request-version;x-project-id;x-sdk-date"&&actualSignature===expectedSignature&&canonicalQueryParity;
  return{ok,selftest:"huawei-aksk-signer",algorithm:"SDK-HMAC-SHA256",canonical_vector:"functiongraph-post-v1-basiccredentials",expected_signature_match:actualSignature===expectedSignature,canonical_query_parity:canonicalQueryParity,secret_echo:false};
}

function configured(env){return Boolean(String(env.HUAWEI_CLOUD_AK||"").trim()&&String(env.HUAWEI_CLOUD_SK||"").trim()&&String(env.HUAWEI_FUNCTION_URN||"").trim())}
function productionEligible(env){return configured(env)&&parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN).ok===true}
function safeError(value){return String(value?.message||value||"HUAWEI_FUNCTIONGRAPH_REQUEST_FAILED").slice(0,180)}
function parseJson(value){if(value&&typeof value==="object")return value;try{return JSON.parse(String(value||""))}catch{return null}}
export function classifyHuaweiError(errorCode,errorMsg){
  const code=String(errorCode||"").trim(),msg=String(errorMsg||"").toLowerCase();
  if(code==="APIGW.0301"||code==="APIG.0301"){
    if(msg.includes("verify aksk signature fail"))return"HUAWEI_AKSK_SIGNATURE_FAILED";
    if(msg.includes("get secretkey failed")||msg.includes("ak not exist"))return"HUAWEI_AK_NOT_FOUND";
    if(msg.includes("reach the limit")||msg.includes("forbidden"))return"HUAWEI_AK_TEMP_LOCKED_OR_RESTRICTED";
    if(msg.includes("decrypt token fail"))return"HUAWEI_TOKEN_DECRYPT_FAILED";
    if(msg.includes("x-auth-token not found"))return"HUAWEI_X_AUTH_TOKEN_MISSING";
    if(msg.includes("token expires")||msg.includes("token expired"))return"HUAWEI_TOKEN_EXPIRED";
    return"HUAWEI_IAM_AUTH_FAILED";
  }
  if(code==="APIGW.0302"||code==="APIG.0302")return"HUAWEI_IAM_NOT_AUTHORIZED";
  return code?"HUAWEI_UPSTREAM_ERROR":"HUAWEI_FUNCTION_INVOCATION_FAILED";
}

export function huaweiFunctionGraphMeta(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN),eligible=productionEligible(env);
  return{
    provider:"huawei-functiongraph",role:"configured-functiongraph-specialist",access_mode:"direct-synchronous-api",trigger_required:false,apig_required:false,auth:"ak-sk-signed",
    configured:eligible,region:parsed.region,function_name:parsed.function_name,project_id_present:Boolean(parsed.project_id),
    lifecycle:eligible?"production-scoped":"unconfigured",runtime_e2e_attested:true,production_acceptance:PRODUCTION_ACCEPTANCE,
    route_eligible:eligible,route_scope:"configured-function-explicit-internal",explicit_selection_only:true,automatic_global_routing:false,
    free_tier_available:true,free_tier_quota_machine_readable:false,cost_guard:"explicit-selection-required-because-overage-can-bill",paid_fallback:false,secret_echo:false
  };
}

export async function probeHuaweiFunctionGraphAuth(env){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN),ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:0,authenticated:false,authorized:false,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const endpoint=`https://functiongraph.${parsed.region}.myhuaweicloud.com`,url=`${endpoint}/v2/${parsed.project_id}/fgs/functions?maxitems=1`,baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk}),response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}}),responseReceivedAt=Date.now(),upstreamDateMs=Date.parse(String(response.headers.get("date")||"")),clockSkewMs=Number.isFinite(upstreamDateMs)?Math.abs(responseReceivedAt-upstreamDateMs):null,clockWithin15m=clockSkewMs===null?null:clockSkewMs<=900000,text=await response.text(),responseBody=parseJson(text)||{},upstreamErrorCode=String(responseBody?.error_code||"").slice(0,80)||null,errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,responseBody?.error_msg),authenticated=response.status!==401;
    return{ok:authenticated,configured:true,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:response.status,authenticated,authorized:response.ok,region:parsed.region,upstream_error_code:upstreamErrorCode,error_class:errorClass,error:authenticated?null:errorClass,upstream_date_present:Number.isFinite(upstreamDateMs),clock_skew_ms:clockSkewMs,clock_within_15m:clockWithin15m,route_eligible:authenticated,route_scope:"configured-function-explicit-internal",paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:0,authenticated:false,authorized:false,region:parsed.region,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),upstream_date_present:false,clock_skew_ms:null,clock_within_15m:null,route_eligible:false,paid_fallback:false,secret_echo:false}}
}

export async function invokeHuaweiFunction(env,payload,{returnLog=false}={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN),ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,error:!parsed.ok?parsed.error:"HUAWEI_AK_SK_NOT_CONFIGURED",http_status:0,route_eligible:false,secret_echo:false};
  const endpoint=`https://functiongraph.${parsed.region}.myhuaweicloud.com`,path=`/v2/${parsed.project_id}/fgs/functions/${parsed.urn}/invocations`,url=`${endpoint}${path}`,body=JSON.stringify(payload&&typeof payload==="object"?payload:{}),baseHeaders={"content-type":"application/json","x-cff-request-version":"v1","x-project-id":parsed.project_id,...(returnLog?{"x-cff-log-type":"tail"}:{})};
  try{
    const signed=await signHuaweiRequest({method:"POST",url,headers:baseHeaders,body,ak,sk}),response=await fetch(url,{method:"POST",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization},body}),text=await response.text(),responseBody=parseJson(text)||{raw:text.slice(0,200)},invokeStatus=Number(responseBody?.status||0)||null,functionResult=parseJson(responseBody?.result),ok=response.ok&&invokeStatus===200,upstreamErrorCode=String(responseBody?.error_code||"").slice(0,80)||null,errorClass=ok?null:classifyHuaweiError(upstreamErrorCode,responseBody?.error_msg);
    return{ok,configured:true,provider:"huawei-functiongraph",http_status:response.status,invoke_status:invokeStatus,request_id:String(responseBody?.request_id||response.headers.get("x-cff-request-id")||"")||null,result:functionResult??responseBody?.result??null,log_returned:returnLog&&Boolean(responseBody?.log),region:parsed.region,function_name:parsed.function_name,route_eligible:ok,route_scope:"configured-function-explicit-internal",explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false,upstream_error_code:upstreamErrorCode,error_class:errorClass,error:ok?null:errorClass};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph",http_status:0,invoke_status:null,request_id:null,result:null,region:parsed.region,function_name:parsed.function_name,route_eligible:false,paid_fallback:false,secret_echo:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error)}}
}

export async function probeHuaweiFunctionGraph(env){
  const payload={selftest:SELFTEST_MARKER,nonce:"huawei-fg-echo"},result=await invokeHuaweiFunction(env,payload);
  if(!result.ok)return{...result,selftest:"huawei-functiongraph",echo_verified:false,acceptance_state:result.configured?"live-e2e-failed":"not-configured"};
  const outer=result.result&&typeof result.result==="object"?result.result:null,echoed=parseJson(outer?.body)||outer,echoVerified=echoed?.selftest===SELFTEST_MARKER&&echoed?.nonce==="huawei-fg-echo";
  return{...result,ok:echoVerified,selftest:"huawei-functiongraph",echo_verified:echoVerified,acceptance_state:echoVerified?"live-echo-e2e-verified":"function-invoked-echo-not-verified",route_eligible:echoVerified,route_scope:"configured-function-explicit-internal",paid_fallback:false,secret_echo:false};
}

export function huaweiJson(body,status=200){return Response.json(body,{status,headers:NO_STORE})}
