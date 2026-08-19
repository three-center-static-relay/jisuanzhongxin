import {huaweiFunctionGraphMeta,huaweiJson,invokeHuaweiFunction,probeHuaweiFunctionGraph} from "./huawei-functiongraph.js";

const HEALTH_TTL_MS=300000;
let healthCache={at:0,value:null};

function internalOnly(url){return url.hostname==="compute.internal"}
async function health(env){
  const now=Date.now();
  if(healthCache.value&&now-healthCache.at<HEALTH_TTL_MS)return{...healthCache.value,cached_health:true,cache_ttl_ms:HEALTH_TTL_MS};
  const value=await probeHuaweiFunctionGraph(env);
  healthCache={at:now,value};
  return{...value,cached_health:false,cache_ttl_ms:HEALTH_TTL_MS};
}

export async function maybeHandleHuaweiFunctionGraph(req,env){
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/meta")return huaweiJson({ok:true,...huaweiFunctionGraphMeta(env)});
  if(req.method==="GET"&&url.pathname==="/v1/providers/huawei-functiongraph/health"){
    const result=await health(env);
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
