import { Sandbox } from "e2b";

const DEFAULT_REGION="cn-beijing";
const API_HOST_SUFFIX="e2b.fc.aliyuncs.com";
const ACCEPTANCE_REVISION="2026-08-20-runtime-e2e-pass";
const MANUAL_ACCEPTANCE_TOKEN_SHA256="5a143d0ffa53b125ff6a463eb7499f71de98d94efa9c1cce33a9ad006f3ef089";
const MAX_EXEC_SECONDS=60;
const MAX_CODE_CHARS=8192;
const MAX_COMMAND_CHARS=2048;
const MAX_OUTPUT_CHARS=32768;

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

function region(env){
  const r=String(env.ALIYUN_FC_SANDBOX_REGION||DEFAULT_REGION).trim();
  return /^[a-z0-9-]{2,40}$/.test(r)?r:DEFAULT_REGION;
}
function apiKey(env){return String(env.ALIYUN_FC_SANDBOX_API_KEY||"").trim()}
function baseUrl(env){return `https://api.${region(env)}.${API_HOST_SUFFIX}`}
function domain(env){return `${region(env)}.${API_HOST_SUFFIX}`}
function internalOnly(u){return u.hostname==="compute.internal"}

async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function manualAcceptanceAuthorized(req){const token=String(req.headers.get("x-three-center-acceptance-token")||"").trim();return Boolean(token)&&await sha256(token)===MANUAL_ACCEPTANCE_TOKEN_SHA256}

async function fetchWithTimeout(url,init={},timeoutMs=12000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:c.signal})}
  catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("ALIYUN_FC_SANDBOX_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}

export function aliyunFCSandboxMeta(env={}){
  return {
    provider:"aliyun-fc-sandbox",
    role:"china-sandbox-explicit-paid-backup",
    protocol:"e2b-compatible-http",
    acceptance_revision:ACCEPTANCE_REVISION,
    region:region(env),
    api_key_secret:"ALIYUN_FC_SANDBOX_API_KEY",
    region_var:"ALIYUN_FC_SANDBOX_REGION",
    capabilities:["sandbox","shell","files","code-interpreter","custom-image"],
    control_plane_probe:"GET /templates",
    auth_header:"X-API-Key",
    route_eligible:Boolean(apiKey(env)),
    route_scope:"explicit-paid-internal-only",
    lifecycle:"production-explicit-paid",
    runtime_e2e_verified:true,
    billing_policy_verified:true,
    paid_execution:true,
    explicit_paid_ack_required:true,
    automatic_global_routing:false,
    paid_fallback:false,
    production_routing:"explicit-only",
    fail_closed:true,
    max_runtime_seconds:MAX_EXEC_SECONDS,
    secrets_redacted:true
  };
}

export async function probeAliyunFCSandbox(env){
  const key=apiKey(env),meta=aliyunFCSandboxMeta(env);
  if(!key)return {...meta,ok:false,configured:false,authenticated:false,authentication_tested:false,http_status:null,route_eligible:false,reason:"ALIYUN_FC_SANDBOX_API_KEY_NOT_CONFIGURED"};
  try{
    const r=await fetchWithTimeout(`${baseUrl(env)}/templates`,{method:"GET",headers:{"X-API-Key":key,accept:"application/json","user-agent":"three-center-compute/2026-08"}});
    const text=await r.text();let parsed=null;try{parsed=text?JSON.parse(text):null}catch{}
    const authenticated=r.ok;
    const templateCount=Array.isArray(parsed)?parsed.length:Array.isArray(parsed?.data)?parsed.data.length:Array.isArray(parsed?.templates)?parsed.templates.length:null;
    return {...meta,ok:authenticated,configured:true,authenticated,authentication_tested:true,http_status:r.status,template_count:templateCount,route_eligible:authenticated,reason:authenticated?"PRODUCTION_EXPLICIT_PAID_READY":`ALIYUN_FC_SANDBOX_HTTP_${r.status}`};
  }catch(e){
    return {...meta,ok:false,configured:true,authenticated:false,authentication_tested:true,http_status:Number(e?.status||0)||null,route_eligible:false,reason:String(e?.message||"ALIYUN_FC_SANDBOX_PROBE_FAILED").slice(0,120)};
  }
}

async function runBoundedRuntimeAcceptance(env){
  const key=apiKey(env),started=Date.now();
  if(!key)return {ok:false,provider:"aliyun-fc-sandbox",configured:false,error:"ALIYUN_FC_SANDBOX_API_KEY_NOT_CONFIGURED",runtime_e2e_verified:false,secrets_redacted:true};
  let sandbox=null;
  try{
    sandbox=await Sandbox.create("code-interpreter-v1",{apiKey:key,apiUrl:baseUrl(env),domain:domain(env),timeoutMs:60000,metadata:{purpose:"three-center-bounded-acceptance"}});
    const shell=await sandbox.commands.run("printf 'ALIYUN_SHELL_OK'",{timeout:15});
    const python=await sandbox.commands.run("python3 -c \"print(6*7)\"",{timeout:15});
    const marker=`three-center-${Date.now()}`;
    await sandbox.files.write("/tmp/three-center-acceptance.txt",marker);
    const fileRead=await sandbox.files.read("/tmp/three-center-acceptance.txt");
    const shellOk=String(shell?.stdout||"").trim()==="ALIYUN_SHELL_OK";
    const pythonOk=String(python?.stdout||"").trim()==="42";
    const fileOk=String(fileRead||"").trim()===marker;
    return {ok:shellOk&&pythonOk&&fileOk,provider:"aliyun-fc-sandbox",acceptance_revision:ACCEPTANCE_REVISION,template:"code-interpreter-v1",shell_ok:shellOk,python_ok:pythonOk,file_write_read_ok:fileOk,runtime_e2e_verified:shellOk&&pythonOk&&fileOk,max_lifetime_seconds:60,paid_execution:true,explicit_paid_ack_required:true,automatic_global_routing:false,paid_fallback:false,production_routing:"explicit-only",route_eligible:shellOk&&pythonOk&&fileOk,elapsed_ms:Date.now()-started,secrets_redacted:true};
  }catch(e){
    return {ok:false,provider:"aliyun-fc-sandbox",acceptance_revision:ACCEPTANCE_REVISION,runtime_e2e_verified:false,error_class:String(e?.name||"ALIYUN_RUNTIME_E2E_FAILED").slice(0,80),message:String(e?.message||"ALIYUN_RUNTIME_E2E_FAILED").slice(0,180),max_lifetime_seconds:60,paid_execution:true,explicit_paid_ack_required:true,automatic_global_routing:false,paid_fallback:false,production_routing:"explicit-only",route_eligible:false,elapsed_ms:Date.now()-started,secrets_redacted:true};
  }finally{if(sandbox){try{await sandbox.kill()}catch{}}}
}

async function runExplicitPaid(req,env){
  const u=new URL(req.url);
  if(!internalOnly(u))return json({ok:false,error:"POLICY_DENIED",message:"Aliyun FC Sandbox execution is service-binding internal only",route_eligible:false,secrets_redacted:true},403);
  if(!apiKey(env))return json({ok:false,error:"ALIYUN_FC_SANDBOX_API_KEY_NOT_CONFIGURED",route_eligible:false,secrets_redacted:true},503);
  let body={};try{body=await req.json()}catch{return json({ok:false,error:"INVALID_JSON"},400)}
  if(body?.allow_paid!==true)return json({ok:false,error:"PAID_EXECUTION_ACK_REQUIRED",message:"Set allow_paid=true for this explicit Aliyun execution request",paid_execution:true,automatic_global_routing:false,paid_fallback:false},402);
  const op=String(body?.op||"python").toLowerCase();
  if(!["python","shell"].includes(op))return json({ok:false,error:"OP_NOT_ALLOWED",allowed_ops:["python","shell"]},400);
  const timeout=Math.max(5,Math.min(MAX_EXEC_SECONDS,Number(body?.timeout_seconds||30)||30));
  const input=String(op==="python"?body?.code||"":body?.command||"");
  const maxChars=op==="python"?MAX_CODE_CHARS:MAX_COMMAND_CHARS;
  if(!input.trim())return json({ok:false,error:op==="python"?"CODE_REQUIRED":"COMMAND_REQUIRED"},400);
  if(input.length>maxChars)return json({ok:false,error:"INPUT_TOO_LARGE",max_chars:maxChars},413);
  let sandbox=null;const started=Date.now();
  try{
    sandbox=await Sandbox.create("code-interpreter-v1",{apiKey:apiKey(env),apiUrl:baseUrl(env),domain:domain(env),timeoutMs:(timeout+15)*1000,metadata:{purpose:"three-center-explicit-paid-compute"}});
    let result;
    if(op==="python"){
      await sandbox.files.write("/tmp/three-center-task.py",input);
      result=await sandbox.commands.run("python3 /tmp/three-center-task.py",{timeout});
    }else result=await sandbox.commands.run(input,{timeout});
    const exitCode=result?.exitCode??result?.exit_code??null;
    return json({ok:exitCode===0||exitCode===null,provider:"aliyun-fc-sandbox",op,http_status:200,exit_code:exitCode,stdout:String(result?.stdout||"").slice(0,MAX_OUTPUT_CHARS),stderr:String(result?.stderr||"").slice(0,MAX_OUTPUT_CHARS),elapsed_ms:Date.now()-started,paid_execution:true,explicit_paid_acknowledged:true,automatic_global_routing:false,paid_fallback:false,route_eligible:true,secrets_redacted:true});
  }catch(e){return json({ok:false,provider:"aliyun-fc-sandbox",op,error_class:String(e?.name||"ALIYUN_EXECUTION_FAILED").slice(0,80),message:String(e?.message||"ALIYUN_EXECUTION_FAILED").slice(0,180),elapsed_ms:Date.now()-started,paid_execution:true,explicit_paid_acknowledged:true,automatic_global_routing:false,paid_fallback:false,route_eligible:false,secrets_redacted:true},502)}
  finally{if(sandbox){try{await sandbox.kill()}catch{}}}
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
  if(req.method==="POST"&&["/v1/providers/aliyun-fc-sandbox/run","/v1/providers/aliyun/run"].includes(u.pathname))return runExplicitPaid(req,env);
  return null;
}
