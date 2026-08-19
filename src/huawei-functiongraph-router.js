import {probeHuaweiCredentialCrosscheck,probeHuaweiDirectFunctionGraphAuthDetail} from "./huawei-functiongraph-diagnostic.js";
import {huaweiFunctionGraphMeta,huaweiJson,huaweiSignerSelftest,invokeHuaweiFunction,probeHuaweiFunctionGraph} from "./huawei-functiongraph.js";

const HEALTH_TTL_MS=300000;
const HEALTH_FORCE_MIN_INTERVAL_MS=300000;
const AUTH_CANARY_TTL_MS=300000;
const CROSSCHECK_TTL_MS=300000;
const AUTH_CIRCUIT_BASE="/auth-circuit/huawei-functiongraph";
const AUTH_CIRCUIT_VERSION="global-do-v1";
let healthCache={at:0,value:null};
let authCanaryCache={at:0,value:null};
let crosscheckCache={at:0,value:null};

function internalOnly(url){return url.hostname==="compute.internal"}
function denyExternalLiveDiagnostic(){return huaweiJson({ok:false,error:"POLICY_DENIED",message:"Huawei live diagnostics are service-binding internal only",route_eligible:false,paid_fallback:false,secret_echo:false},403)}
function credentialShape(env){
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  return{
    ok:Boolean(ak&&sk),
    provider:"huawei-functiongraph",
    diagnostic:"credential-shape",
    ak_present:Boolean(ak),
    sk_present:Boolean(sk),
    ak_length:ak.length,
    sk_length:sk.length,
    ak_alnum:/^[A-Za-z0-9]+$/.test(ak),
    sk_alnum:/^[A-Za-z0-9]+$/.test(sk),
    secret_echo:false
  };
}
function authFailure(value){
  const status=Number(value?.http_status||0),code=String(value?.upstream_error_code||""),detail=String(value?.auth_detail_class||""),cls=String(value?.error_class||"");
  return status===401||code==="APIGW.0301"||code==="APIG.0301"||detail==="SIGNATURE_RELATED"||detail==="AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED"||detail==="AK_RESTRICTED_OR_RATE_LIMITED"||cls==="HUAWEI_AKSK_SIGNATURE_FAILED"||cls==="HUAWEI_IAM_AUTH_FAILED"||cls==="HUAWEI_AK_NOT_FOUND"||cls==="HUAWEI_AK_TEMP_LOCKED_OR_RESTRICTED";
}
function circuitStub(env){return env.CENTER_GATE?.get&&env.CENTER_GATE?.idFromName?env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global")):null}
async function circuitCall(env,suffix,body){
  const stub=circuitStub(env);
  if(!stub)return{ok:false,error:"AUTH_CIRCUIT_UNAVAILABLE",cooldown_active:true,cooldown_remaining_ms:300000,upstream_allowed:false};
  const init={method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})};
  try{const response=await stub.fetch(new Request(`https://gate.internal${AUTH_CIRCUIT_BASE}/${suffix}`,init));return{http:response.status,...await response.json().catch(()=>({ok:false,error:"AUTH_CIRCUIT_BAD_RESPONSE"}))}}catch{return{ok:false,error:"AUTH_CIRCUIT_UNAVAILABLE",cooldown_active:true,cooldown_remaining_ms:300000,upstream_allowed:false}}
}
function suppressed(acquire){
  const cooldown=acquire?.error==="AUTH_COOLDOWN"||acquire?.cooldown_active===true;
  return{ok:false,configured:true,provider:"huawei-functiongraph",authenticated:false,authorized:false,http_status:0,error_class:cooldown?"HUAWEI_AUTH_COOLDOWN_ACTIVE":acquire?.error==="AUTH_PROBE_INFLIGHT"?"HUAWEI_AUTH_PROBE_INFLIGHT":"HUAWEI_AUTH_CIRCUIT_UNAVAILABLE",auth_detail_class:cooldown?"GLOBAL_COOLDOWN":"PROBE_SUPPRESSED",cooldown_active:cooldown,cooldown_remaining_ms:Number(acquire?.cooldown_remaining_ms||0),probe_inflight:acquire?.probe_inflight===true,probe_remaining_ms:Number(acquire?.probe_remaining_ms||0),upstream_called:false,auth_circuit:"global-durable-object",route_eligible:false,paid_fallback:false,secret_echo:false};
}
async function withAuthCircuit(env,probe){
  const acquired=await circuitCall(env,"acquire",{});
  if(acquired.ok!==true)return suppressed(acquired);
  const attemptId=String(acquired.attempt_id||"");
  try{
    const value=await probe();
    const failed=authFailure(value);
    const closed=await circuitCall(env,"result",{attempt_id:attemptId,auth_failed:failed});
    return{...value,auth_circuit:"global-durable-object",cooldown_active:failed,cooldown_remaining_ms:failed?Number(closed?.cooldown_remaining_ms||300000):0,probe_inflight:false,upstream_called:value?.upstream_called!==false,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){
    await circuitCall(env,"result",{attempt_id:attemptId,auth_failed:false});
    return{ok:false,configured:true,provider:"huawei-functiongraph",authenticated:false,authorized:false,http_status:0,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",auth_circuit:"global-durable-object",cooldown_active:false,cooldown_remaining_ms:0,probe_inflight:false,upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false,error_name:String(error?.name||"Error")};
  }
}
async function authCanary(env){
  const now=Date.now(),age=authCanaryCache.value?Math.max(0,now-authCanaryCache.at):Infinity;
  if(authCanaryCache.value&&age<AUTH_CANARY_TTL_MS)return{...authCanaryCache.value,cached_canary:true,cache_age_ms:age,cache_ttl_ms:AUTH_CANARY_TTL_MS};
  const value=await withAuthCircuit(env,()=>probeHuaweiDirectFunctionGraphAuthDetail(env));
  authCanaryCache={at:now,value};
  return{...value,cached_canary:false,cache_age_ms:0,cache_ttl_ms:AUTH_CANARY_TTL_MS};
}
async function credentialCrosscheck(env){
  const now=Date.now(),age=crosscheckCache.value?Math.max(0,now-crosscheckCache.at):Infinity;
  if(crosscheckCache.value&&age<CROSSCHECK_TTL_MS)return{...crosscheckCache.value,cached_crosscheck:true,cache_age_ms:age,cache_ttl_ms:CROSSCHECK_TTL_MS};
  const value=await withAuthCircuit(env,()=>probeHuaweiCredentialCrosscheck(env));
  crosscheckCache={at:now,value};
  return{...value,cached_crosscheck:false,cache_age_ms:0,cache_ttl_ms:CROSSCHECK_TTL_MS};
}
async function health(env,{force=false}={}){
  const now=Date.now();
  const age=healthCache.value?Math.max(0,now-healthCache.at):Infinity;
  if(healthCache.value&&((!force&&age<HEALTH_TTL_MS)||(force&&age<HEALTH_FORCE_MIN_INTERVAL_MS))){
    return{...healthCache.value,cached_health:true,cache_ttl_ms:HEALTH_TTL_MS,cache_age_ms:age,fresh_probe_requested:force,refresh_suppressed:force&&age<HEALTH_FORCE_MIN_INTERVAL_MS};
  }
  const value=await withAuthCircuit(env,()=>probeHuaweiFunctionGraph(env));
  healthCache={at:now,value};
  return{...value,cached_health:false,cache_ttl_ms:HEALTH_TTL_MS,cache_age_ms:0,fresh_probe_requested:force,refresh_suppressed:false};
}

export async function maybeHandleHuaweiFunctionGraph(req,env){
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/meta")return huaweiJson({ok:true,...huaweiFunctionGraphMeta(env),auth_circuit:AUTH_CIRCUIT_VERSION,auth_probe_cooldown_ms:300000,live_probe_scope:"service-binding-internal-only"});
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/credential-shape")return huaweiJson(credentialShape(env));
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/signer-selftest")return huaweiJson(await huaweiSignerSelftest());
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/auth-canary"){
    if(!internalOnly(url))return denyExternalLiveDiagnostic();
    const result=await authCanary(env);
    return huaweiJson(result,result.authenticated===true?200:503);
  }
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/credential-crosscheck"){
    if(!internalOnly(url))return denyExternalLiveDiagnostic();
    const result=await credentialCrosscheck(env);
    return huaweiJson(result,result.authenticated===true?200:503);
  }
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/health"){
    if(!internalOnly(url))return denyExternalLiveDiagnostic();
    const result=await health(env,{force:url.searchParams.get("fresh")==="1"});
    return huaweiJson(result,result.ok===true?200:503);
  }
  if(req.method==="POST"&&url.pathname==="/v1/providers/huawei-functiongraph/compute"){
    if(!internalOnly(url))return huaweiJson({ok:false,error:"POLICY_DENIED",message:"Huawei FunctionGraph execution is service-binding internal only",route_eligible:false,secret_echo:false},403);
    let body={};try{body=await req.json()}catch{return huaweiJson({ok:false,error:"INVALID_JSON",route_eligible:false,secret_echo:false},400)}
    const encoded=JSON.stringify(body);
    if(encoded.length>65536)return huaweiJson({ok:false,error:"PAYLOAD_TOO_LARGE",max_bytes:65536,route_eligible:false,secret_echo:false},413);
    const result=await invokeHuaweiFunction(env,body);
    return huaweiJson(result,result.ok===true?200:503);
  }
  return null;
}
