import {probeHuaweiCredentialCrosscheck,probeHuaweiDirectFunctionGraphAuthDetail} from "./huawei-functiongraph-diagnostic.js";
import {huaweiFunctionGraphMeta,huaweiJson,huaweiSignerSelftest,invokeHuaweiFunction,probeHuaweiFunctionGraph,probeHuaweiFunctionGraphAuth} from "./huawei-functiongraph.js";

const HEALTH_TTL_MS=300000;
const HEALTH_FORCE_MIN_INTERVAL_MS=30000;
const AUTH_CANARY_TTL_MS=300000;
const CROSSCHECK_TTL_MS=300000;
const DIRECT_FG_AUTH_AUDIT_PATH="/v1/providers/huawei-functiongraph/direct-fg-auth-audit-6c38e291";
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
async function authCanary(env){
  const now=Date.now(),age=authCanaryCache.value?Math.max(0,now-authCanaryCache.at):Infinity;
  if(authCanaryCache.value&&age<AUTH_CANARY_TTL_MS)return{...authCanaryCache.value,cached_canary:true,cache_age_ms:age,cache_ttl_ms:AUTH_CANARY_TTL_MS};
  const value=await probeHuaweiFunctionGraphAuth(env);
  authCanaryCache={at:now,value};
  return{...value,cached_canary:false,cache_age_ms:0,cache_ttl_ms:AUTH_CANARY_TTL_MS};
}
async function credentialCrosscheck(env){
  const now=Date.now(),age=crosscheckCache.value?Math.max(0,now-crosscheckCache.at):Infinity;
  if(crosscheckCache.value&&age<CROSSCHECK_TTL_MS)return{...crosscheckCache.value,cached_crosscheck:true,cache_age_ms:age,cache_ttl_ms:CROSSCHECK_TTL_MS};
  const value=await probeHuaweiCredentialCrosscheck(env);
  crosscheckCache={at:now,value};
  return{...value,cached_crosscheck:false,cache_age_ms:0,cache_ttl_ms:CROSSCHECK_TTL_MS};
}
async function health(env,{force=false}={}){
  const now=Date.now();
  const age=healthCache.value?Math.max(0,now-healthCache.at):Infinity;
  if(healthCache.value&&((!force&&age<HEALTH_TTL_MS)||(force&&age<HEALTH_FORCE_MIN_INTERVAL_MS))){
    return{...healthCache.value,cached_health:true,cache_ttl_ms:HEALTH_TTL_MS,cache_age_ms:age,fresh_probe_requested:force,refresh_suppressed:force&&age<HEALTH_FORCE_MIN_INTERVAL_MS};
  }
  const value=await probeHuaweiFunctionGraph(env);
  healthCache={at:now,value};
  return{...value,cached_health:false,cache_ttl_ms:HEALTH_TTL_MS,cache_age_ms:0,fresh_probe_requested:force,refresh_suppressed:false};
}

export async function maybeHandleHuaweiFunctionGraph(req,env){
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/meta")return huaweiJson({ok:true,...huaweiFunctionGraphMeta(env)});
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/credential-shape")return huaweiJson(credentialShape(env));
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/signer-selftest")return huaweiJson(await huaweiSignerSelftest());
  if(req.method==="GET"&&url.pathname===DIRECT_FG_AUTH_AUDIT_PATH){
    const result=await probeHuaweiDirectFunctionGraphAuthDetail(env);
    return huaweiJson({...result,audit_scope:"one-shot-direct-functiongraph-auth-detail"},result.authenticated===true?200:503);
  }
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
