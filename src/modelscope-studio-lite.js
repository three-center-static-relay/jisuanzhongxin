const OPENAPI="https://modelscope.cn/openapi/v1";
const LEGACY="https://modelscope.cn/api/v1";
const REPO_NAME="three-center-cpu-lite";
const SDK_TYPE="gradio";
const TARGET_HARDWARE="platform/2v-cpu-16g-mem";
const TARGET_CPU=2;
const TARGET_MEMORY_GB=16;
const MIN_EFFECTIVE_CPU=1.9;
const MIN_EFFECTIVE_MEMORY_GIB=14;
const REVISION="studio-lite-runtime-v3-20260820";
const MARKER="THREE_CENTER_MODELSCOPE_LITE_RUNTIME:";
const str=v=>String(v??"").trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}
function headers(t,json=true){const h={authorization:`Bearer ${t}`,accept:"application/json"};if(json)h["content-type"]="application/json";return h}
function legacyHeaders(t){return{authorization:`Bearer ${t}`,cookie:`m_session_id=${encodeURIComponent(t)}`,accept:"application/json","content-type":"application/json"}}
async function req(url,{method="GET",headers:h={},body=null,timeout=20000}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{method,headers:h,body:body===null?undefined:JSON.stringify(body),signal:c.signal});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    return{ok:r.ok,status:r.status,data,text:text.slice(0,2048)};
  }catch(e){return{ok:false,status:e?.name==="AbortError"?504:0,error:e?.name==="AbortError"?"TIMEOUT":str(e?.message)||"FETCH_FAILED",data:null,text:""}}
  finally{clearTimeout(timer)}
}
function payload(x){return x?.data?.data??x?.data??x}
function objects(v,out=[]){if(out.length>256)return out;if(Array.isArray(v)){for(const x of v)objects(x,out)}else if(v&&typeof v==="object"){out.push(v);for(const x of Object.values(v))objects(x,out)}return out}
function strings(v,out=[]){if(out.length>2048)return out;if(typeof v==="string")out.push(v);else if(Array.isArray(v)){for(const x of v)strings(x,out)}else if(v&&typeof v==="object"){for(const x of Object.values(v))strings(x,out)}return out}
function username(raw){for(const o of objects(raw)){for(const k of ["Username","username","preferred_username","user_name","userName","name"]){const v=str(o?.[k]);if(v&&/^[A-Za-z0-9_.-]{1,80}$/.test(v))return v}}return null}
function hardwareRows(raw){const direct=raw?.hardware||raw?.data?.hardware||raw?.data?.data?.hardware;if(Array.isArray(direct))return direct;for(const o of objects(raw)){if(Array.isArray(o?.hardware))return o.hardware}return[]}
function targetHardware(raw){for(const h of hardwareRows(raw)){const name=str(h?.name),type=str(h?.resource_type||h?.resourceType).toLowerCase();if(name===TARGET_HARDWARE&&type==="free")return{name,resource_type:type,cpu:Number(h?.cpu||TARGET_CPU),memory_gb:Number(h?.memory||TARGET_MEMORY_GB),has_stock:h?.has_stock!==false}}return null}
function b64(s){const a=new TextEncoder().encode(s);let bin="";for(let i=0;i<a.length;i+=8192)bin+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(bin)}
function appPy(){return `import hashlib,json,os,platform,time\nMARKER=${JSON.stringify(MARKER)}\nREVISION=${JSON.stringify(REVISION)}\n\ndef _read(p):\n    try:\n        with open(p,'r') as f:return f.read().strip()\n    except Exception:return ''\n\ndef _cpu():\n    logical=os.cpu_count() or 0\n    raw=_read('/sys/fs/cgroup/cpu.max')\n    if raw:\n        p=raw.split()\n        if len(p)>=2 and p[0]!='max':\n            try:return min(float(logical),float(p[0])/float(p[1]))\n            except Exception:pass\n    return float(logical)\n\ndef _mem():\n    host=0.0\n    for line in _read('/proc/meminfo').splitlines():\n        if line.startswith('MemTotal:'):\n            try:host=float(line.split()[1])/1024/1024\n            except Exception:pass\n    lim=_read('/sys/fs/cgroup/memory.max')\n    if lim and lim!='max':\n        try:\n            cg=float(lim)/1024/1024/1024\n            return min(host,cg) if host>0 else cg\n        except Exception:pass\n    return host\n\nt0=time.time();n=1000000\ncalc=sum(i*i for i in range(1,n+1));expected=n*(n+1)*(2*n+1)//6\ncpu=_cpu();mem=_mem()\nreceipt={'ok':bool(calc==expected and cpu>=${MIN_EFFECTIVE_CPU} and mem>=${MIN_EFFECTIVE_MEMORY_GIB}),'revision':REVISION,'cpu_effective':round(cpu,3),'memory_gib_effective':round(mem,3),'nominal_cpu':${TARGET_CPU},'nominal_memory_gb':${TARGET_MEMORY_GB},'square_sum_correct':calc==expected,'result_digest':hashlib.sha256(str(calc).encode()).hexdigest(),'python':platform.python_version(),'elapsed_s':round(time.time()-t0,6)}\nprint(MARKER+json.dumps(receipt,separators=(',',':'),sort_keys=True),flush=True)\n\ndef status():return json.dumps(receipt,separators=(',',':'),sort_keys=True)\n\nimport gradio as gr\ndemo=gr.Interface(fn=status,inputs=None,outputs='text',title='Three Center ModelScope Lite CPU')\ndemo.launch(server_name='0.0.0.0',server_port=7860)\n`}
function operation(path,content,action){const size=new TextEncoder().encode(content).length;return{action,path,type:"normal",size,sha256:"",content:b64(content),encoding:"base64"}}
function parseReceipt(raw){for(const s of strings(raw)){for(const line of s.split(/\r?\n/)){const i=line.indexOf(MARKER);if(i<0)continue;try{const x=JSON.parse(line.slice(i+MARKER.length).trim());if(x?.revision===REVISION)return x}catch{}}}return null}
function receiptPass(x){return x?.ok===true&&x?.revision===REVISION&&Number(x?.cpu_effective)>=MIN_EFFECTIVE_CPU&&Number(x?.memory_gib_effective)>=MIN_EFFECTIVE_MEMORY_GIB&&x?.square_sum_correct===true&&/^[a-f0-9]{64}$/i.test(str(x?.result_digest))}
function cleanReceipt(x){if(!x)return null;return{ok:x.ok===true,revision:str(x.revision),cpu_effective:Number(x.cpu_effective||0),memory_gib_effective:Number(x.memory_gib_effective||0),nominal_cpu:Number(x.nominal_cpu||0),nominal_memory_gb:Number(x.nominal_memory_gb||0),square_sum_correct:x.square_sum_correct===true,result_digest:str(x.result_digest),python:str(x.python),elapsed_s:Number(x.elapsed_s||0)}}
async function detail(t,owner){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}`,{headers:headers(t,false)})}
async function logs(t,owner){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/logs/run?page_num=1&page_size=100`,{headers:headers(t,false),timeout:15000})}
async function stop(t,owner){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/stop`,{method:"POST",headers:headers(t),body:null,timeout:15000})}
async function deploy(t,owner){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/deploy`,{method:"POST",headers:headers(t),body:null,timeout:15000})}
async function patchSettings(t,owner){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/settings`,{method:"PATCH",headers:headers(t),body:{display_name:"Three Center CPU Lite",visibility:"private",sdk_type:SDK_TYPE,hardware:TARGET_HARDWARE},timeout:15000})}
async function createStudio(t,owner){return req(`${OPENAPI}/studios`,{method:"POST",headers:headers(t),body:{repo_name:REPO_NAME,owner,display_name:"Three Center CPU Lite",visibility:"private",sdk_type:SDK_TYPE,hardware:TARGET_HARDWARE,description:"Three-center free-only light CPU runner"},timeout:20000})}
async function commitAppAction(t,owner,action){return req(`${LEGACY}/repos/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/commit/master`,{method:"POST",headers:legacyHeaders(t),body:{commit_message:`Three-center Studio Lite ${REVISION}`,actions:[operation("app.py",appPy(),action)]},timeout:30000})}
async function ensureApp(t,owner){
  const update=await commitAppAction(t,owner,"update");
  if(update.ok)return{ok:true,action:"update",http_status:update.status};
  if(![400,404,409,422].includes(update.status))return{ok:false,action:"update",http_status:update.status,error_class:`MODELSCOPE_STUDIO_COMMIT_HTTP_${update.status}`};
  const create=await commitAppAction(t,owner,"create");
  return create.ok?{ok:true,action:"create",http_status:create.status}:{ok:false,action:"create",http_status:create.status,error_class:`MODELSCOPE_STUDIO_COMMIT_HTTP_${create.status}`};
}
async function identity(env={}){
  const t=token(env);if(!t)return{ok:false,configured:false,error_class:"MODELSCOPE_TOKEN_REQUIRED"};
  const me=await req(`${OPENAPI}/users/me`,{headers:headers(t,false)}),owner=me.ok?username(payload(me)):null;
  const ok=me.ok&&Boolean(owner);
  return{ok,configured:true,authenticated:me.status!==401&&me.status!==403,token:t,owner,identity_status:me.status,error_class:ok?null:!me.ok?`MODELSCOPE_IDENTITY_HTTP_${me.status}`:"MODELSCOPE_OWNER_UNRESOLVED"};
}
async function readiness(env={}){
  const id=await identity(env);if(!id.ok)return id;
  const hw=await req(`${OPENAPI}/studios/hardware?sdk_type=${encodeURIComponent(SDK_TYPE)}&studio=${encodeURIComponent(`${id.owner}/${REPO_NAME}`)}`,{headers:headers(id.token,false)}),target=hw.ok?targetHardware(hw.data):null;
  const ok=hw.ok&&Boolean(target);
  return{...id,ok,target,stock_available:target?.has_stock===true,hardware_status:hw.status,error_class:ok?null:!hw.ok?`MODELSCOPE_HARDWARE_HTTP_${hw.status}`:"TARGET_FREE_HARDWARE_UNAVAILABLE"};
}

export async function getModelScopeStudioLiteStatus(env={}){
  const id=await identity(env);if(!id.ok)return{ok:false,selftest:"modelscope-studio-lite",configured:id.configured===true,authenticated:id.authenticated===true,target_hardware:TARGET_HARDWARE,hardware:null,runtime_e2e_verified:false,route_eligible:false,error_class:id.error_class,free_only:true,paid_fallback:false,secrets_redacted:true};
  const hw=await req(`${OPENAPI}/studios/hardware?sdk_type=${encodeURIComponent(SDK_TYPE)}&studio=${encodeURIComponent(`${id.owner}/${REPO_NAME}`)}`,{headers:headers(id.token,false)}),target=hw.ok?targetHardware(hw.data):null;
  const d=await detail(id.token,id.owner),l=d.ok?await logs(id.token,id.owner):null,receipt=l?.ok?parseReceipt(payload(l)):null,pass=receiptPass(receipt);
  return{ok:pass,selftest:"modelscope-studio-lite",configured:true,authenticated:true,target_hardware:TARGET_HARDWARE,hardware:target,catalog_verified:Boolean(target),stock_available:target?.has_stock===true,studio_found:d.ok,studio_detail_http_status:d.status,log_http_status:l?.status||null,runtime_receipt:cleanReceipt(receipt),runtime_e2e_verified:pass,route_eligible:pass&&Boolean(target),error_class:pass?null:!d.ok?`MODELSCOPE_STUDIO_DETAIL_HTTP_${d.status}`:!l?.ok?`MODELSCOPE_STUDIO_LOG_HTTP_${l?.status||0}`:"MODELSCOPE_STUDIO_LITE_NOT_VERIFIED",free_only:true,paid_fallback:false,secrets_redacted:true};
}

export async function prepareModelScopeStudioLite(env={}){
  const r=await readiness(env),t=r.token;
  if(!r.ok)return{ok:false,stage:"readiness",error_class:r.error_class,hardware:r.target||null,free_only:true,paid_fallback:false,secrets_redacted:true};
  let d=await detail(t,r.owner),created=false;
  if(!d.ok){
    if(d.status!==404)return{ok:false,stage:"detail",error_class:`MODELSCOPE_STUDIO_DETAIL_HTTP_${d.status}`,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true};
    const c=await createStudio(t,r.owner);if(!c.ok)return{ok:false,stage:"create",create_http_status:c.status,error_class:`MODELSCOPE_STUDIO_CREATE_HTTP_${c.status}`,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true};
    created=true;await sleep(1200);
  }
  const app=await ensureApp(t,r.owner);if(!app.ok){await stop(t,r.owner);return{ok:false,stage:"upload",upload_http_status:app.http_status,error_class:app.error_class,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true}}
  const settings=await patchSettings(t,r.owner);if(!settings.ok){await stop(t,r.owner);return{ok:false,stage:"settings",settings_http_status:settings.status,error_class:`MODELSCOPE_STUDIO_SETTINGS_HTTP_${settings.status}`,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true}}
  return{ok:true,stage:"prepared",studio_created:created,upload_action:app.action,upload_http_status:app.http_status,settings_http_status:settings.status,hardware:r.target,stock_available:r.stock_available===true,free_only:true,paid_fallback:false,secrets_redacted:true};
}

export async function deployModelScopeStudioLite(env={}){
  const r=await readiness(env),t=r.token;
  if(!r.ok)return{ok:false,stage:"readiness",error_class:r.error_class,hardware:r.target||null,free_only:true,paid_fallback:false,secrets_redacted:true};
  const d=await detail(t,r.owner);if(!d.ok)return{ok:false,stage:"detail",error_class:`MODELSCOPE_STUDIO_DETAIL_HTTP_${d.status}`,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true};
  const dep=await deploy(t,r.owner);
  return dep.ok?{ok:true,stage:"deployed",deploy_http_status:dep.status,hardware:r.target,stock_available:r.stock_available===true,free_only:true,paid_fallback:false,secrets_redacted:true}:{ok:false,stage:"deploy",deploy_http_status:dep.status,error_class:`MODELSCOPE_STUDIO_DEPLOY_HTTP_${dep.status}`,hardware:r.target,free_only:true,paid_fallback:false,secrets_redacted:true};
}

export async function stopModelScopeStudioLite(env={}){
  const id=await identity(env);if(!id.ok)return{ok:false,stage:"identity",error_class:id.error_class,free_only:true,paid_fallback:false,secrets_redacted:true};
  const s=await stop(id.token,id.owner);
  return{ok:s.ok,stage:s.ok?"stopped":"stop-failed",stop_http_status:s.status,error_class:s.ok?null:`MODELSCOPE_STUDIO_STOP_HTTP_${s.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
}

export async function runModelScopeStudioLiteBootstrap(env={}){
  const prep=await prepareModelScopeStudioLite(env);if(!prep.ok)return prep;
  const dep=await deployModelScopeStudioLite(env);if(!dep.ok){await stopModelScopeStudioLite(env);return dep}
  const id=await identity(env);if(!id.ok){await stopModelScopeStudioLite(env);return{...id,stage:"post-deploy-identity",free_only:true,paid_fallback:false,secrets_redacted:true}}
  let receipt=null,lastLogStatus=0;
  for(let i=0;i<25;i++){await sleep(3000);const l=await logs(id.token,id.owner);lastLogStatus=l.status;if(l.ok){receipt=parseReceipt(payload(l));if(receipt)break}}
  const stopped=await stopModelScopeStudioLite(env),pass=receiptPass(receipt);
  return{ok:pass,stage:pass?"runtime-verified":"runtime-not-verified",studio_created:prep.studio_created,upload_action:prep.upload_action,upload_http_status:prep.upload_http_status,settings_http_status:prep.settings_http_status,deploy_http_status:dep.deploy_http_status,log_http_status:lastLogStatus,stop_http_status:stopped.stop_http_status,hardware:prep.hardware,runtime_receipt:cleanReceipt(receipt),runtime_e2e_verified:pass,route_eligible:pass,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:pass?null:"MODELSCOPE_STUDIO_LITE_RUNTIME_E2E_FAILED"};
}

export const modelScopeStudioLiteMeta=()=>({provider:"modelscope",repo_name:REPO_NAME,sdk_type:SDK_TYPE,target_hardware:TARGET_HARDWARE,nominal_cpu:TARGET_CPU,nominal_memory_gb:TARGET_MEMORY_GB,min_effective_cpu:MIN_EFFECTIVE_CPU,min_effective_memory_gib:MIN_EFFECTIVE_MEMORY_GIB,revision:REVISION,phased_runner:true,idempotent_upload:true,stop_requires_hardware_catalog:false,free_only:true,paid_fallback:false});
