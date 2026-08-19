const DEFAULT_REGION="cn-beijing";
const API_HOST_SUFFIX="e2b.fc.aliyuncs.com";

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

function region(env){
  const r=String(env.ALIYUN_FC_SANDBOX_REGION||DEFAULT_REGION).trim();
  return /^[a-z0-9-]{2,40}$/.test(r)?r:DEFAULT_REGION;
}
function apiKey(env){return String(env.ALIYUN_FC_SANDBOX_API_KEY||"").trim()}
function baseUrl(env){return `https://api.${region(env)}.${API_HOST_SUFFIX}`}

async function fetchWithTimeout(url,init={},timeoutMs=12000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:c.signal})}
  catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("ALIYUN_FC_SANDBOX_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}

export function aliyunFCSandboxMeta(env={}){
  return {
    provider:"aliyun-fc-sandbox",
    role:"china-sandbox-candidate",
    protocol:"e2b-compatible-http",
    region:region(env),
    api_key_secret:"ALIYUN_FC_SANDBOX_API_KEY",
    region_var:"ALIYUN_FC_SANDBOX_REGION",
    capabilities:["sandbox","shell","files","code-interpreter","browser","custom-image"],
    control_plane_probe:"GET /templates",
    auth_header:"X-API-Key",
    route_eligible:false,
    lifecycle:"candidate",
    runtime_e2e_verified:false,
    billing_policy_verified:false,
    paid_fallback:false,
    production_routing:false,
    fail_closed:true,
    secrets_redacted:true
  };
}

export async function probeAliyunFCSandbox(env){
  const key=apiKey(env),meta=aliyunFCSandboxMeta(env);
  if(!key)return {...meta,ok:false,configured:false,authenticated:false,authentication_tested:false,http_status:null,reason:"ALIYUN_FC_SANDBOX_API_KEY_NOT_CONFIGURED"};
  try{
    const r=await fetchWithTimeout(`${baseUrl(env)}/templates`,{method:"GET",headers:{"X-API-Key":key,accept:"application/json","user-agent":"three-center-compute/2026-08"}});
    const text=await r.text();let parsed=null;try{parsed=text?JSON.parse(text):null}catch{}
    const authenticated=r.ok;
    const templateCount=Array.isArray(parsed)?parsed.length:Array.isArray(parsed?.data)?parsed.data.length:Array.isArray(parsed?.templates)?parsed.templates.length:null;
    return {...meta,ok:authenticated,configured:true,authenticated,authentication_tested:true,http_status:r.status,template_count:templateCount,reason:authenticated?"CONTROL_PLANE_AUTHENTICATED_AWAITING_RUNTIME_AND_BILLING_ACCEPTANCE":`ALIYUN_FC_SANDBOX_HTTP_${r.status}`};
  }catch(e){
    return {...meta,ok:false,configured:true,authenticated:false,authentication_tested:true,http_status:Number(e?.status||0)||null,reason:String(e?.message||"ALIYUN_FC_SANDBOX_PROBE_FAILED").slice(0,120)};
  }
}

export async function maybeHandleAliyunFCSandbox(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/providers/aliyun-fc-sandbox/meta")return json({ok:true,...aliyunFCSandboxMeta(env)});
  if(req.method==="GET"&&u.pathname==="/v1/providers/aliyun-fc-sandbox/health"){
    const p=await probeAliyunFCSandbox(env);return json(p,p.ok?200:503);
  }
  if(req.method==="POST"&&["/v1/providers/aliyun-fc-sandbox/run","/v1/providers/aliyun/run"].includes(u.pathname)){
    return json({ok:false,error:"CANDIDATE_NOT_PROMOTED",message:"Aliyun FC Sandbox is control-plane integrated but production execution remains fail-closed until runtime E2E and billing policy acceptance pass",provider:"aliyun-fc-sandbox",route_eligible:false,production_routing:false,secrets_redacted:true},503);
  }
  return null;
}
