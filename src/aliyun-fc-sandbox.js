const DEFAULT_REGION="cn-beijing";
const API_HOST_SUFFIX="e2b.fc.aliyuncs.com";
const ENVD_PORT=49983;
const JUPYTER_PORT=49999;
const ACCEPTANCE_REVISION="2026-08-19-native-http-v1";
const MANUAL_ACCEPTANCE_TOKEN_SHA256="5a143d0ffa53b125ff6a463eb7499f71de98d94efa9c1cce33a9ad006f3ef089";

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

function region(env){
  const r=String(env.ALIYUN_FC_SANDBOX_REGION||DEFAULT_REGION).trim();
  return /^[a-z0-9-]{2,40}$/.test(r)?r:DEFAULT_REGION;
}
function apiKey(env){return String(env.ALIYUN_FC_SANDBOX_API_KEY||"").trim()}
function baseUrl(env){return `https://api.${region(env)}.${API_HOST_SUFFIX}`}
function defaultDomain(env){return `${region(env)}.${API_HOST_SUFFIX}`}
function safeDomain(v,fallback){const d=String(v||"").trim().replace(/^https?:\/\//i,"").replace(/\/$/,"");return /^[a-z0-9.-]{3,253}$/i.test(d)?d:fallback}
function sandboxUrl(id,port,domain){return `https://${port}-${id}.${domain}`}

async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function manualAcceptanceAuthorized(req){const token=String(req.headers.get("x-three-center-acceptance-token")||"").trim();return Boolean(token)&&await sha256(token)===MANUAL_ACCEPTANCE_TOKEN_SHA256}

async function fetchWithTimeout(url,init={},timeoutMs=12000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:c.signal,redirect:"follow"})}
  catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("ALIYUN_FC_SANDBOX_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}
async function apiJson(url,init,timeoutMs,stage){
  const r=await fetchWithTimeout(url,init,timeoutMs),text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
  if(!r.ok)throw Object.assign(new Error(`${stage}_HTTP_${r.status}`),{status:r.status,stage});
  return {response:r,data};
}
function sandboxHeaders(id,port,envdAccessToken,trafficAccessToken){
  const h={"E2b-Sandbox-Id":id,"E2b-Sandbox-Port":String(port),accept:"application/json","user-agent":"three-center-compute/2026-08"};
  if(envdAccessToken)h["X-Access-Token"]=envdAccessToken;
  if(trafficAccessToken)h["E2B-Traffic-Access-Token"]=trafficAccessToken;
  return h;
}

export function aliyunFCSandboxMeta(env={}){
  return {
    provider:"aliyun-fc-sandbox",
    role:"china-sandbox-candidate",
    protocol:"e2b-compatible-native-http",
    acceptance_revision:ACCEPTANCE_REVISION,
    region:region(env),
    api_key_secret:"ALIYUN_FC_SANDBOX_API_KEY",
    region_var:"ALIYUN_FC_SANDBOX_REGION",
    capabilities:["sandbox","shell","files","code-interpreter","browser","custom-image"],
    control_plane_probe:"GET /templates",
    runtime_probe:"POST /sandboxes -> Jupyter /execute -> DELETE /sandboxes/{id}",
    auth_header:"X-API-Key",
    external_sdk_dependency:false,
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

function parseJupyterStream(text){
  const rows=[];for(const line of String(text||"").split(/\r?\n/)){const t=line.trim();if(!t)continue;try{rows.push(JSON.parse(t))}catch{}}
  const stdout=rows.filter(x=>x?.type==="stdout").map(x=>String(x?.text||"")).join("");
  const stderr=rows.filter(x=>x?.type==="stderr").map(x=>String(x?.text||"")).join("");
  const errors=rows.filter(x=>x?.type==="error").map(x=>({name:String(x?.name||"ExecutionError").slice(0,80),value:String(x?.value||"").slice(0,160)}));
  return {stdout,stderr,errors,event_count:rows.length};
}
function acceptancePayload(){
  return [
    "import json, subprocess",
    "p='/tmp/three-center-acceptance.txt'",
    "shell=subprocess.run(['/bin/bash','-lc','printf ALIYUN_SHELL_OK'],capture_output=True,text=True,timeout=5)",
    "value=6*7",
    "marker='ALIYUN_FILE_OK'",
    "open(p,'w',encoding='utf-8').write(marker)",
    "readback=open(p,'r',encoding='utf-8').read()",
    "print(json.dumps({'shell':shell.stdout.strip(),'shell_rc':shell.returncode,'python':value,'file':readback},separators=(',',':')))"
  ].join("\n");
}
function decodeAcceptanceStdout(stdout){
  for(const line of String(stdout||"").split(/\r?\n/).reverse()){const t=line.trim();if(!t.startsWith("{"))continue;try{return JSON.parse(t)}catch{}}
  return null;
}

async function runBoundedRuntimeAcceptance(env){
  const key=apiKey(env),started=Date.now();
  if(!key)return {ok:false,provider:"aliyun-fc-sandbox",configured:false,error:"ALIYUN_FC_SANDBOX_API_KEY_NOT_CONFIGURED",runtime_e2e_verified:false,secrets_redacted:true};
  let sandboxId="",destroyed=false,destroyHttpStatus=null,outcome=null;
  try{
    const created=await apiJson(`${baseUrl(env)}/sandboxes`,{method:"POST",headers:{"X-API-Key":key,"content-type":"application/json",accept:"application/json","user-agent":"three-center-compute/2026-08"},body:JSON.stringify({templateID:"code-interpreter-v1",timeout:60,secure:true,metadata:{purpose:"three-center-one-shot-acceptance"}})},20000,"ALIYUN_SANDBOX_CREATE");
    const info=created.data||{};sandboxId=String(info.sandboxID||"").trim();
    if(!sandboxId)throw Object.assign(new Error("ALIYUN_SANDBOX_CREATE_MISSING_ID"),{stage:"create"});
    const envdAccessToken=String(info.envdAccessToken||"").trim(),trafficAccessToken=String(info.trafficAccessToken||"").trim();
    const sbDomain=safeDomain(info.domain,defaultDomain(env));
    const envdHealth=await fetchWithTimeout(`${sandboxUrl(sandboxId,ENVD_PORT,sbDomain)}/health`,{method:"GET",headers:sandboxHeaders(sandboxId,ENVD_PORT,envdAccessToken,trafficAccessToken)},10000);
    const envdOk=envdHealth.ok||envdHealth.status===204;
    if(!envdOk)throw Object.assign(new Error(`ALIYUN_ENVD_HEALTH_HTTP_${envdHealth.status}`),{status:envdHealth.status,stage:"envd-health"});
    const exec=await fetchWithTimeout(`${sandboxUrl(sandboxId,JUPYTER_PORT,sbDomain)}/execute`,{method:"POST",headers:{...sandboxHeaders(sandboxId,JUPYTER_PORT,envdAccessToken,trafficAccessToken),"content-type":"application/json"},body:JSON.stringify({code:acceptancePayload(),context_id:null,language:"python",env_vars:{}})},25000);
    const execText=await exec.text();if(!exec.ok)throw Object.assign(new Error(`ALIYUN_JUPYTER_EXECUTE_HTTP_${exec.status}`),{status:exec.status,stage:"execute"});
    const parsed=parseJupyterStream(execText),marker=decodeAcceptanceStdout(parsed.stdout);
    const shellOk=marker?.shell==="ALIYUN_SHELL_OK"&&Number(marker?.shell_rc)===0;
    const pythonOk=Number(marker?.python)===42;
    const fileOk=marker?.file==="ALIYUN_FILE_OK";
    const noExecutionError=parsed.errors.length===0;
    outcome={ok:shellOk&&pythonOk&&fileOk&&noExecutionError,provider:"aliyun-fc-sandbox",acceptance_revision:ACCEPTANCE_REVISION,template:"code-interpreter-v1",control_plane_create_ok:true,envd_health_ok:envdOk,shell_ok:shellOk,python_ok:pythonOk,file_write_read_ok:fileOk,execution_error_count:parsed.errors.length,jupyter_event_count:parsed.event_count,runtime_e2e_verified:shellOk&&pythonOk&&fileOk&&noExecutionError,max_lifetime_seconds:60,external_sdk_dependency:false,paid_fallback:false,production_routing:false,route_eligible:false,secrets_redacted:true};
  }catch(e){
    outcome={ok:false,provider:"aliyun-fc-sandbox",acceptance_revision:ACCEPTANCE_REVISION,runtime_e2e_verified:false,failure_stage:String(e?.stage||"runtime").slice(0,60),error_class:String(e?.message||"ALIYUN_RUNTIME_E2E_FAILED").slice(0,120),http_status:Number(e?.status||0)||null,max_lifetime_seconds:60,external_sdk_dependency:false,paid_fallback:false,production_routing:false,route_eligible:false,secrets_redacted:true};
  }finally{
    if(sandboxId){
      try{const r=await fetchWithTimeout(`${baseUrl(env)}/sandboxes/${encodeURIComponent(sandboxId)}`,{method:"DELETE",headers:{"X-API-Key":key,accept:"application/json","user-agent":"three-center-compute/2026-08"}},12000);destroyHttpStatus=r.status;destroyed=r.ok||r.status===404}catch{destroyed=false}
    }
  }
  const safeDestroyed=!sandboxId||destroyed;
  return {...outcome,ok:outcome?.ok===true&&safeDestroyed,runtime_e2e_verified:outcome?.runtime_e2e_verified===true&&safeDestroyed,sandbox_destroyed:safeDestroyed,destroy_http_status:destroyHttpStatus,elapsed_ms:Date.now()-started};
}

export async function maybeHandleAliyunFCSandbox(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/providers/aliyun-fc-sandbox/meta")return json({ok:true,...aliyunFCSandboxMeta(env)});
  if(req.method==="GET"&&u.pathname==="/v1/providers/aliyun-fc-sandbox/health"){
    const p=await probeAliyunFCSandbox(env);return json(p,p.ok?200:503);
  }
  if(req.method==="POST"&&u.pathname==="/v1/selftest/aliyun-fc-sandbox-runtime"){
    if(!await manualAcceptanceAuthorized(req))return json({ok:false,error:"UNAUTHORIZED",secrets_redacted:true},401);
    const p=await runBoundedRuntimeAcceptance(env);return json(p,p.ok?200:503);
  }
  if(req.method==="POST"&&["/v1/providers/aliyun-fc-sandbox/run","/v1/providers/aliyun/run"].includes(u.pathname)){
    return json({ok:false,error:"CANDIDATE_NOT_PROMOTED",message:"Aliyun FC Sandbox is control-plane integrated but production execution remains fail-closed until runtime E2E and billing policy acceptance pass",provider:"aliyun-fc-sandbox",route_eligible:false,production_routing:false,secrets_redacted:true},503);
  }
  return null;
}
