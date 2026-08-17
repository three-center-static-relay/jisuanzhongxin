const OPENAPI="https://modelscope.cn/openapi/v1";
const LEGACY="https://modelscope.cn/api/v1";
const REPO_NAME="three-center-cpu-runner";
const SDK_TYPE="gradio";
const MIN_CPU=8;
const MIN_MEMORY_GB=30;
const RUNTIME_MARKER="THREE_CENTER_MODELSCOPE_CPU_RUNTIME:";
const BOOTSTRAP_REVISION="studio-cpu-runtime-v1-20260817";
const str=v=>String(v??"").trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}
function authHeaders(t,json=true){const h={authorization:`Bearer ${t}`,accept:"application/json"};if(json)h["content-type"]="application/json";return h}
function legacyHeaders(t){return {authorization:`Bearer ${t}`,cookie:`m_session_id=${encodeURIComponent(t)}`,accept:"application/json","content-type":"application/json"}}
async function request(url,{method="GET",headers={},body=null,timeout=20000}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:c.signal});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    return{ok:r.ok,status:r.status,data,text:text.slice(0,4096)};
  }catch(e){return{ok:false,status:e?.name==="AbortError"?504:0,data:null,text:"",error:e?.name==="AbortError"?"TIMEOUT":str(e?.message)||"FETCH_FAILED"}}
  finally{clearTimeout(timer)}
}
function payload(v){return v?.data?.data??v?.data??v}
function objects(v,out=[]){if(out.length>256)return out;if(Array.isArray(v)){for(const x of v)objects(x,out)}else if(v&&typeof v==="object"){out.push(v);for(const x of Object.values(v))objects(x,out)}return out}
function strings(v,out=[]){if(out.length>2048)return out;if(typeof v==="string")out.push(v);else if(Array.isArray(v)){for(const x of v)strings(x,out)}else if(v&&typeof v==="object"){for(const x of Object.values(v))strings(x,out)}return out}
function firstNumber(o,keys){for(const k of keys){const n=Number(o?.[k]);if(Number.isFinite(n)&&n>=0)return n}return null}
function hardwareName(o){return str(o?.name||o?.hardware||o?.resource_name||o?.resourceName||o?.instance_type||o?.instanceType||o?.id||o?.value)}
function cpuCount(o,name){const n=firstNumber(o,["cpu","cpus","cpu_count","cpuCount","vcpu","vcpus","cpu_num","cpuNum","cores"]);if(n!==null)return n;const m=name.match(/(?:^|\/|[-_])(\d+(?:\.\d+)?)v?-?cpu(?:[-_/]|$)/i)||name.match(/(\d+(?:\.\d+)?)\s*(?:v?cpu|cores?)/i);return m?Number(m[1]):null}
function memoryGb(o,name){let n=firstNumber(o,["memory_gb","memoryGB","memoryGb","mem_gb","ram_gb"]);if(n!==null)return n;n=firstNumber(o,["memory","memory_mb","memoryMB","mem","ram"]);if(n!==null)return n>512?n/1024:n;const m=name.match(/(\d+(?:\.\d+)?)g-?mem/i)||name.match(/(\d+(?:\.\d+)?)\s*(?:gb|gib)(?:\s|[-_/]|$)/i);return m?Number(m[1]):null}
function isExplicitFree(o,name){const rt=str(o?.resource_type||o?.resourceType||o?.billing_type||o?.billingType||o?.type).toLowerCase();const price=firstNumber(o,["price","cost","hourly_price","hourlyPrice"]);const positive=o?.free===true||o?.is_free===true||o?.isFree===true||rt==="free"||rt==="platform"||name.toLowerCase().startsWith("platform/")||price===0;const paid=rt.includes("paid")||name.toLowerCase().startsWith("paid/")||(price!==null&&price>0);return positive&&!paid}
function summarizeHardware(raw){
  const rows=[];
  for(const o of objects(raw)){
    const name=hardwareName(o);if(!name)continue;
    const cpu=cpuCount(o,name),memory_gb=memoryGb(o,name),free=isExplicitFree(o,name);
    if(cpu===null&&memory_gb===null&&!/cpu/i.test(name))continue;
    rows.push({name,cpu,memory_gb,free});
  }
  const uniq=[...new Map(rows.map(x=>[x.name,x])).values()];
  const eligible=uniq.filter(x=>x.free&&Number(x.cpu)>=MIN_CPU&&Number(x.memory_gb)>=MIN_MEMORY_GB&&!/gpu/i.test(x.name)).sort((a,b)=>(a.cpu-b.cpu)||(a.memory_gb-b.memory_gb)||a.name.localeCompare(b.name));
  return{all_count:uniq.length,free_count:uniq.filter(x=>x.free).length,eligible_count:eligible.length,selected:eligible[0]||null};
}
function findUsername(raw){for(const o of objects(raw)){for(const k of ["username","user_name","userName","name"]){const v=str(o?.[k]);if(v&&/^[A-Za-z0-9_.-]{1,80}$/.test(v))return v}}return null}
function urlOwner(v){return encodeURIComponent(v)}
function urlRepo(v){return encodeURIComponent(v)}
async function identityAndHardware(env){
  const t=token(env);if(!t)return{ok:false,error_class:"MODELSCOPE_TOKEN_REQUIRED",configured:false};
  const me=await request(`${OPENAPI}/users/me`,{headers:authHeaders(t,false)});
  const hardware=await request(`${OPENAPI}/studios/hardware?sdk_type=${encodeURIComponent(SDK_TYPE)}`,{headers:authHeaders(t,false)});
  const owner=me.ok?findUsername(payload(me)):null,summary=hardware.ok?summarizeHardware(payload(hardware)):{all_count:0,free_count:0,eligible_count:0,selected:null};
  const ok=me.ok&&hardware.ok&&Boolean(owner)&&Boolean(summary.selected);
  return{ok,configured:true,authenticated:me.status!==401&&me.status!==403,owner,hardware:summary,identity_status:me.status,hardware_status:hardware.status,error_class:ok?null:!me.ok?`MODELSCOPE_IDENTITY_HTTP_${me.status}`:!owner?"MODELSCOPE_OWNER_UNRESOLVED":!hardware.ok?`MODELSCOPE_HARDWARE_HTTP_${hardware.status}`:"NO_EXPLICIT_FREE_8C30G_CPU"};
}
function bytes(s){return new TextEncoder().encode(s)}
function b64(s){const a=bytes(s);let bin="";for(let i=0;i<a.length;i+=8192)bin+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(bin)}
function runnerApp(){return `import hashlib,json,math,os,platform,sys,time\n\nMARKER=${JSON.stringify(RUNTIME_MARKER)}\nREVISION=${JSON.stringify(BOOTSTRAP_REVISION)}\n\ndef _read(path):\n    try:\n        with open(path,'r') as f:return f.read().strip()\n    except Exception:return ''\n\ndef _effective_cpu():\n    logical=os.cpu_count() or 0\n    raw=_read('/sys/fs/cgroup/cpu.max')\n    quota=None\n    if raw:\n        p=raw.split()\n        if len(p)>=2 and p[0]!='max':\n            try:quota=float(p[0])/float(p[1])\n            except Exception:quota=None\n    return float(min(logical,quota)) if quota is not None else float(logical)\n\ndef _effective_mem_gb():\n    host=0.0\n    raw=_read('/proc/meminfo')\n    for line in raw.splitlines():\n        if line.startswith('MemTotal:'):\n            try:host=float(line.split()[1])/1024/1024\n            except Exception:pass\n    cgroup=_read('/sys/fs/cgroup/memory.max')\n    lim=None\n    if cgroup and cgroup!='max':\n        try:lim=float(cgroup)/1024/1024/1024\n        except Exception:lim=None\n    return min(host,lim) if lim is not None and host>0 else (lim if lim is not None else host)\n\ndef _version(mod):\n    try:\n        m=__import__(mod);return str(getattr(m,'__version__','unknown'))[:80]\n    except Exception:return None\n\nt0=time.time();n=1000000\ncalc=sum(i*i for i in range(1,n+1));expected=n*(n+1)*(2*n+1)//6\ncpu=_effective_cpu();mem=_effective_mem_gb()\nreceipt={'ok':bool(calc==expected and cpu>=${MIN_CPU} and mem>=${MIN_MEMORY_GB}),'revision':REVISION,'cpu_effective':cpu,'memory_gb_effective':round(mem,3),'python':platform.python_version(),'numpy':_version('numpy'),'torch':_version('torch'),'square_sum_correct':calc==expected,'result_digest':hashlib.sha256(str(calc).encode()).hexdigest(),'elapsed_s':round(time.time()-t0,6)}\nprint(MARKER+json.dumps(receipt,separators=(',',':'),sort_keys=True),flush=True)\n\ndef status():return json.dumps(receipt,separators=(',',':'),sort_keys=True)\n\ntry:\n    import gradio as gr\n    demo=gr.Interface(fn=status,inputs=None,outputs='text',title='Three Center CPU Runner')\n    demo.launch(server_name='0.0.0.0',server_port=7860)\nexcept Exception as e:\n    print('THREE_CENTER_RUNNER_FATAL:'+type(e).__name__,flush=True);raise\n`}
function readme(){return `# Three Center ModelScope CPU Runner\n\nManaged runtime for the three-center compute system.\n\n- free CPU only\n- no paid fallback\n- private Studio\n- runtime acceptance revision: ${BOOTSTRAP_REVISION}\n`}
function operation(path,content,action){const data=bytes(content);return{action,path,type:"normal",size:data.length,sha256:"",content:b64(content),encoding:"base64"}}
async function studioDetail(t,owner){return request(`${OPENAPI}/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}`,{headers:authHeaders(t,false)})}
async function runLogs(t,owner){return request(`${OPENAPI}/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}/logs/run?page_size=100`,{headers:authHeaders(t,false),timeout:20000})}
function parseReceipt(raw){for(const s of strings(raw)){for(const line of s.split(/\r?\n/)){const at=line.indexOf(RUNTIME_MARKER);if(at<0)continue;const tail=line.slice(at+RUNTIME_MARKER.length).trim();try{const x=JSON.parse(tail);if(x&&x.revision===BOOTSTRAP_REVISION)return x}catch{}}}return null}
async function listFiles(t,owner){return request(`${LEGACY}/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}/repo/files?Revision=master&Recursive=True`,{headers:legacyHeaders(t)})}
function existingPaths(raw){const set=new Set();for(const o of objects(raw)){for(const k of ["Path","path","Name","name","FilePath","file_path"]){const v=str(o?.[k]);if(v)set.add(v.replace(/^\/+/,""))}}return set}
async function commitRunner(t,owner){
  const listed=await listFiles(t,owner),paths=listed.ok?existingPaths(payload(listed)):new Set();
  const files=[["app.py",runnerApp()],["README.md",readme()]];
  const actions=files.map(([path,content])=>operation(path,content,paths.has(path)?"update":"create"));
  return request(`${LEGACY}/repos/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}/commit/master`,{method:"POST",headers:legacyHeaders(t),body:{commit_message:`Three-center CPU runner ${BOOTSTRAP_REVISION}`,actions},timeout:30000});
}
async function stopStudio(t,owner){return request(`${OPENAPI}/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}/stop`,{method:"POST",headers:authHeaders(t),body:{},timeout:20000})}
async function deployStudio(t,owner){return request(`${OPENAPI}/studios/${urlOwner(owner)}/${urlRepo(REPO_NAME)}/deploy`,{method:"POST",headers:authHeaders(t),body:{},timeout:20000})}
async function ensureStudio(t,owner,hardware){
  const detail=await studioDetail(t,owner);if(detail.ok)return{ok:true,created:false,status:detail.status};
  if(detail.status!==404)return{ok:false,created:false,status:detail.status,error_class:`MODELSCOPE_STUDIO_DETAIL_HTTP_${detail.status}`};
  const created=await request(`${OPENAPI}/studios`,{method:"POST",headers:authHeaders(t),body:{owner,repo_name:REPO_NAME,sdk_type:SDK_TYPE,visibility:"private",hardware:hardware.name,display_name:"Three Center CPU Runner"},timeout:20000});
  return{ok:created.ok||created.status===409,created:created.ok,status:created.status,error_class:created.ok||created.status===409?null:`MODELSCOPE_STUDIO_CREATE_HTTP_${created.status}`};
}
function sanitizeReceipt(x){if(!x)return null;return{ok:x.ok===true,revision:str(x.revision),cpu_effective:Number(x.cpu_effective||0),memory_gb_effective:Number(x.memory_gb_effective||0),python:str(x.python),numpy:x.numpy?str(x.numpy):null,torch:x.torch?str(x.torch):null,square_sum_correct:x.square_sum_correct===true,result_digest:str(x.result_digest),elapsed_s:Number(x.elapsed_s||0)}}
function receiptPass(x){return x?.ok===true&&x?.revision===BOOTSTRAP_REVISION&&Number(x?.cpu_effective)>=MIN_CPU&&Number(x?.memory_gb_effective)>=MIN_MEMORY_GB&&x?.square_sum_correct===true&&/^[a-f0-9]{64}$/i.test(str(x?.result_digest))}

export async function getModelScopeStudioStatus(env={}){
  const ready=await identityAndHardware(env),t=token(env);
  if(!ready.configured)return{ok:false,selftest:"modelscope-studio-cpu",configured:false,authenticated:false,runtime_e2e_verified:false,error_class:ready.error_class,free_only:true,paid_fallback:false,secrets_redacted:true};
  if(!ready.owner)return{ok:false,selftest:"modelscope-studio-cpu",configured:true,authenticated:ready.authenticated===true,runtime_e2e_verified:false,error_class:ready.error_class,free_cpu_candidate:ready.hardware?.selected||null,free_only:true,paid_fallback:false,secrets_redacted:true};
  const detail=await studioDetail(t,ready.owner),logs=detail.ok?await runLogs(t,ready.owner):null,receipt=logs?.ok?parseReceipt(payload(logs)):null;
  const pass=receiptPass(receipt);
  return{ok:pass,selftest:"modelscope-studio-cpu",configured:true,authenticated:ready.authenticated===true,studio_found:detail.ok,studio_detail_http_status:detail.status,free_cpu_candidate:ready.hardware?.selected||null,runtime_receipt:sanitizeReceipt(receipt),runtime_e2e_verified:pass,route_eligible:pass,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:pass?null:!detail.ok?`MODELSCOPE_STUDIO_DETAIL_HTTP_${detail.status}`:!logs?.ok?`MODELSCOPE_STUDIO_LOG_HTTP_${logs?.status||0}`:"MODELSCOPE_STUDIO_RUNTIME_NOT_VERIFIED"};
}

export async function runModelScopeStudioBootstrap(env={}){
  const ready=await identityAndHardware(env),t=token(env);
  if(!ready.ok)return{ok:false,stage:"readiness",error_class:ready.error_class,hardware:ready.hardware,free_only:true,paid_fallback:false,secrets_redacted:true};
  const prior=await runLogs(t,ready.owner);const priorReceipt=prior.ok?parseReceipt(payload(prior)):null;
  if(receiptPass(priorReceipt)){await stopStudio(t,ready.owner);return{ok:true,stage:"already-verified",runtime_receipt:sanitizeReceipt(priorReceipt),hardware:ready.hardware.selected,free_only:true,paid_fallback:false,secrets_redacted:true}}
  const ensured=await ensureStudio(t,ready.owner,ready.hardware.selected);if(!ensured.ok)return{ok:false,stage:"create",error_class:ensured.error_class,hardware:ready.hardware.selected,free_only:true,paid_fallback:false,secrets_redacted:true};
  const committed=await commitRunner(t,ready.owner);if(!committed.ok){await stopStudio(t,ready.owner);return{ok:false,stage:"upload",error_class:`MODELSCOPE_STUDIO_COMMIT_HTTP_${committed.status}`,free_only:true,paid_fallback:false,secrets_redacted:true}}
  const deployed=await deployStudio(t,ready.owner);if(!deployed.ok){await stopStudio(t,ready.owner);return{ok:false,stage:"deploy",error_class:`MODELSCOPE_STUDIO_DEPLOY_HTTP_${deployed.status}`,free_only:true,paid_fallback:false,secrets_redacted:true}}
  let receipt=null,lastLogStatus=0;
  for(let i=0;i<18;i++){await sleep(3000);const logs=await runLogs(t,ready.owner);lastLogStatus=logs.status;if(logs.ok){receipt=parseReceipt(payload(logs));if(receipt)break}}
  const stopped=await stopStudio(t,ready.owner),pass=receiptPass(receipt);
  return{ok:pass,stage:pass?"runtime-verified":"runtime-not-verified",studio_created:ensured.created,upload_http_status:committed.status,deploy_http_status:deployed.status,log_http_status:lastLogStatus,stop_http_status:stopped.status,runtime_receipt:sanitizeReceipt(receipt),hardware:ready.hardware.selected,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:pass?null:"MODELSCOPE_STUDIO_RUNTIME_E2E_FAILED"};
}

export const modelScopeStudioMeta=()=>({provider:"modelscope",repo_name:REPO_NAME,sdk_type:SDK_TYPE,min_cpu:MIN_CPU,min_memory_gb:MIN_MEMORY_GB,bootstrap_revision:BOOTSTRAP_REVISION,code_sync:"legacy-studio-commit-api",runtime_attestation:"run-log-marker",free_only:true,paid_fallback:false,public_write_endpoint:false});
