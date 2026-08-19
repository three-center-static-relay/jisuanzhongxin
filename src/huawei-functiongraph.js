const encoder=new TextEncoder();
const NO_STORE={"cache-control":"no-store"};
const SELFTEST_MARKER="compute-worker-huawei-functiongraph-v1";

const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
async function sha256Hex(value){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
async function hmacSha256Hex(secret,value){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
function sdkEncode(value){return encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}
function canonicalUri(pathname){
  const value=String(pathname||"/").split("/").map(sdkEncode).join("/");
  return value.endsWith("/")?value:`${value}/`;
}
function sdkDate(date=new Date()){
  return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
function normalizeHeaderValue(value){return String(value??"").trim().replace(/\s+/g," ")}
function canonicalHeaders(headers){
  return Object.entries(headers).map(([key,value])=>[key.toLowerCase(),normalizeHeaderValue(value)]).sort((a,b)=>a[0].localeCompare(b[0]));
}

export function parseHuaweiFunctionUrn(value){
  const urn=String(value||"").trim();
  const parts=urn.split(":");
  const valid=parts.length>=7&&parts[0]==="urn"&&parts[1]==="fss"&&/^[a-z0-9-]+$/.test(parts[2]||"")&&/^[A-Za-z0-9]{32}$/.test(parts[3]||"")&&parts[4]==="function"&&/^[A-Za-z0-9_-]+$/.test(parts[5]||"")&&/^[A-Za-z0-9_-]+$/.test(parts[6]||"");
  if(!valid)return{ok:false,error:"INVALID_HUAWEI_FUNCTION_URN",urn:null,region:null,project_id:null,package_name:null,function_name:null};
  return{ok:true,urn,region:parts[2],project_id:parts[3],package_name:parts[5],function_name:parts[6],qualifier:parts.length>7?parts.slice(7).join(":"):null};
}

export async function signHuaweiRequest({method="POST",url,headers={},body="",ak,sk,date=new Date()}){
  const target=new URL(url);
  const xSdkDate=sdkDate(date);
  const signingHeaders={...headers,host:target.host,"x-sdk-date":xSdkDate};
  const ordered=canonicalHeaders(signingHeaders);
  const signedHeaderNames=ordered.map(([key])=>key).join(";");
  const canonicalHeaderBlock=ordered.map(([key,value])=>`${key}:${value}\n`).join("");
  const payloadHash=await sha256Hex(body||"");
  const request=[String(method).toUpperCase(),canonicalUri(target.pathname),target.searchParams.toString(),canonicalHeaderBlock,signedHeaderNames,payloadHash].join("\n");
  const requestHash=await sha256Hex(request);
  const stringToSign=["SDK-HMAC-SHA256",xSdkDate,requestHash].join("\n");
  const signature=await hmacSha256Hex(sk,stringToSign);
  return{authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,x_sdk_date:xSdkDate,signed_headers:signedHeaderNames};
}

export async function huaweiSignerSelftest(){
  const project="0123456789abcdef0123456789abcdef";
  const urn=`urn:fss:cn-south-4:${project}:function:default:test1:latest`;
  const url=`https://functiongraph.cn-south-4.myhuaweicloud.com/v2/${project}/fgs/functions/${urn}/invocations`;
  const signed=await signHuaweiRequest({method:"POST",url,headers:{"content-type":"application/json","x-cff-request-version":"v1"},body:'{"selftest":"ok"}',ak:"AK_TEST",sk:"SK_TEST",date:new Date("2026-08-19T09:00:00.000Z")});
  const expectedSignature="7b2748b6497aa801ebc9e19078d94777bd37d00143e141c7f09e5d0c6cbbd3f1";
  const actualSignature=String(signed.authorization||"").split("Signature=")[1]||"";
  const ok=signed.x_sdk_date==="20260819T090000Z"&&signed.signed_headers==="content-type;host;x-cff-request-version;x-sdk-date"&&actualSignature===expectedSignature;
  return{ok,selftest:"huawei-aksk-signer",algorithm:"SDK-HMAC-SHA256",canonical_vector:"functiongraph-post-v1-sdk-headers",expected_signature_match:actualSignature===expectedSignature,secret_echo:false};
}

function configured(env){return Boolean(String(env.HUAWEI_CLOUD_AK||"").trim()&&String(env.HUAWEI_CLOUD_SK||"").trim()&&String(env.HUAWEI_FUNCTION_URN||"").trim())}
function safeError(value){return String(value?.message||value||"HUAWEI_FUNCTIONGRAPH_REQUEST_FAILED").slice(0,180)}
function parseJson(value){if(value&&typeof value==="object")return value;try{return JSON.parse(String(value||""))}catch{return null}}
export function classifyHuaweiError(errorCode,errorMsg){
  const code=String(errorCode||"").trim();
  const msg=String(errorMsg||"").toLowerCase();
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
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  return{
    provider:"huawei-functiongraph",
    access_mode:"direct-synchronous-api",
    trigger_required:false,
    apig_required:false,
    auth:"ak-sk-signed",
    configured:configured(env)&&parsed.ok===true,
    region:parsed.region,
    function_name:parsed.function_name,
    project_id_present:Boolean(parsed.project_id),
    free_tier_guard:"candidate-only-until-live-e2e-and-quota-guard",
    paid_fallback:false,
    route_eligible:false,
    secret_echo:false
  };
}

export async function probeHuaweiFunctionGraphAuth(env){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:0,authenticated:false,authorized:false,error_class:!parsed.ok?"INVALID_HUAWEI_FUNCTION_URN":"HUAWEI_AK_SK_NOT_CONFIGURED",route_eligible:false,paid_fallback:false,secret_echo:false};
  const endpoint=`https://functiongraph.${parsed.region}.myhuaweicloud.com`;
  const url=`${endpoint}/v2/${parsed.project_id}/fgs/functions?maxitems=1`;
  const baseHeaders={"content-type":"application/json"};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const response=await fetch(url,{method:"GET",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization}});
    const responseReceivedAt=Date.now();
    const upstreamDateMs=Date.parse(String(response.headers.get("date")||""));
    const clockSkewMs=Number.isFinite(upstreamDateMs)?Math.abs(responseReceivedAt-upstreamDateMs):null;
    const clockWithin15m=clockSkewMs===null?null:clockSkewMs<=900000;
    const text=await response.text();
    const responseBody=parseJson(text)||{};
    const upstreamErrorCode=String(responseBody?.error_code||"").slice(0,80)||null;
    const errorClass=response.ok?null:classifyHuaweiError(upstreamErrorCode,responseBody?.error_msg);
    const authenticated=response.status!==401;
    return{ok:authenticated,configured:true,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:response.status,authenticated,authorized:response.ok,region:parsed.region,upstream_error_code:upstreamErrorCode,error_class:errorClass,error:authenticated?null:errorClass,upstream_date_present:Number.isFinite(upstreamDateMs),clock_skew_ms:clockSkewMs,clock_within_15m:clockWithin15m,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph",canary:"list-functions-auth",http_status:0,authenticated:false,authorized:false,region:parsed.region,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error),upstream_date_present:false,clock_skew_ms:null,clock_within_15m:null,route_eligible:false,paid_fallback:false,secret_echo:false}}
}

export async function invokeHuaweiFunction(env,payload,{returnLog=false}={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!ak||!sk||!parsed.ok)return{ok:false,configured:false,error:!parsed.ok?parsed.error:"HUAWEI_AK_SK_NOT_CONFIGURED",http_status:0,route_eligible:false,secret_echo:false};
  const endpoint=`https://functiongraph.${parsed.region}.myhuaweicloud.com`;
  const path=`/v2/${parsed.project_id}/fgs/functions/${parsed.urn}/invocations`;
  const url=`${endpoint}${path}`;
  const body=JSON.stringify(payload&&typeof payload==="object"?payload:{});
  const baseHeaders={"content-type":"application/json","x-cff-request-version":"v1",...(returnLog?{"x-cff-log-type":"tail"}:{})};
  try{
    const signed=await signHuaweiRequest({method:"POST",url,headers:baseHeaders,body,ak,sk});
    const response=await fetch(url,{method:"POST",headers:{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization},body});
    const text=await response.text();
    const responseBody=parseJson(text)||{raw:text.slice(0,200)};
    const invokeStatus=Number(responseBody?.status||0)||null;
    const functionResult=parseJson(responseBody?.result);
    const ok=response.ok&&invokeStatus===200;
    const upstreamErrorCode=String(responseBody?.error_code||"").slice(0,80)||null;
    const errorClass=ok?null:classifyHuaweiError(upstreamErrorCode,responseBody?.error_msg);
    return{ok,configured:true,provider:"huawei-functiongraph",http_status:response.status,invoke_status:invokeStatus,request_id:String(responseBody?.request_id||response.headers.get("x-cff-request-id")||"")||null,result:functionResult??responseBody?.result??null,log_returned:returnLog&&Boolean(responseBody?.log),region:parsed.region,function_name:parsed.function_name,route_eligible:false,paid_fallback:false,secret_echo:false,upstream_error_code:upstreamErrorCode,error_class:errorClass,error:ok?null:errorClass};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph",http_status:0,invoke_status:null,request_id:null,result:null,region:parsed.region,function_name:parsed.function_name,route_eligible:false,paid_fallback:false,secret_echo:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",error:safeError(error)}}
}

export async function probeHuaweiFunctionGraph(env){
  const payload={selftest:SELFTEST_MARKER,nonce:"huawei-fg-echo"};
  const result=await invokeHuaweiFunction(env,payload);
  if(!result.ok)return{...result,selftest:"huawei-functiongraph",echo_verified:false,acceptance_state:result.configured?"live-e2e-failed":"not-configured"};
  const outer=result.result&&typeof result.result==="object"?result.result:null;
  const echoed=parseJson(outer?.body)||outer;
  const echoVerified=echoed?.selftest===SELFTEST_MARKER&&echoed?.nonce==="huawei-fg-echo";
  return{...result,ok:echoVerified,selftest:"huawei-functiongraph",echo_verified:echoVerified,acceptance_state:echoVerified?"live-echo-e2e-verified":"function-invoked-echo-not-verified",route_eligible:false,paid_fallback:false,secret_echo:false};
}

export function huaweiJson(body,status=200){return Response.json(body,{status,headers:NO_STORE})}
