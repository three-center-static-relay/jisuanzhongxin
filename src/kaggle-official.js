const API_BASE="https://api.kaggle.com/v1";
const MAX_JSON_BYTES=2_000_000;
const STATUS_NUM={0:"queued",1:"running",2:"completed",3:"failed",4:"cancel_requested",5:"cancelled",6:"queued"};
const STATUS_STR={QUEUED:"queued",RUNNING:"running",COMPLETE:"completed",COMPLETED:"completed",ERROR:"failed",FAILED:"failed",CANCEL_REQUESTED:"cancel_requested",CANCEL_ACKNOWLEDGED:"cancelled",CANCELLED:"cancelled",NEW_SCRIPT:"queued"};
const clamp=(v,a,b,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,Math.trunc(n))):d};
function token(env){const t=String(env.KAGGLE_API_TOKEN||"").trim();if(!t)throw Object.assign(new Error("KAGGLE_API_TOKEN_NOT_CONFIGURED"),{status:503});return t}
async function requestJson(env,service,method,body,timeoutMs=15_000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(`${API_BASE}/${service}/${method}`,{method:"POST",headers:{authorization:`Bearer ${token(env)}`,"content-type":"application/json",accept:"application/json","user-agent":"three-center-compute/2026-08"},body:JSON.stringify(body||{}),signal:c.signal});
    const text=await r.text();
    if(new TextEncoder().encode(text).length>MAX_JSON_BYTES)throw Object.assign(new Error("KAGGLE_RESPONSE_TOO_LARGE"),{status:502});
    let data={};if(text){try{data=JSON.parse(text)}catch{throw Object.assign(new Error("KAGGLE_BAD_JSON"),{status:502})}}
    if(!r.ok||Number(data?.code||0)>=400){const e=Object.assign(new Error(String(data?.message||data?.errorMessage||`KAGGLE_HTTP_${r.status}`)),{status:r.status>=400?r.status:502,kaggleStatus:r.status});throw e}
    return data;
  }catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("KAGGLE_TIMEOUT"),{status:504});throw e}finally{clearTimeout(timer)}
}
export async function introspect(env){const t=token(env),r=await requestJson(env,"security.OAuthService","IntrospectToken",{token:t});if(r?.active!==true||!String(r?.username||"").trim())throw Object.assign(new Error("KAGGLE_TOKEN_INACTIVE"),{status:401});return{active:true,username:String(r.username),user_id:Number(r.userId||r.user_id||0)||null,scope:String(r.scope||"")}}
function slugify(v){return String(v||"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"task"}
function makeCpuScript(taskId,profile,input={}){
  const matrix=clamp(input.matrix_size,128,768,384),samples=clamp(input.monte_carlo_samples,100_000,1_500_000,500_000),seed=clamp(input.seed,1,2_147_483_647,20260815);
  return `import json,time,hashlib,math\nimport numpy as np\nt0=time.time(); rng=np.random.default_rng(${seed})\nA=rng.normal(size=(${matrix},${matrix})); B=rng.normal(size=(${matrix},${matrix})); C=A@B\nM=rng.normal(size=(160,160)); S=M.T@M+np.eye(160)*0.1; b=rng.normal(size=160); x=np.linalg.solve(S,b)\np=rng.random((${samples},2)); pi=float(4*np.mean(np.sum(p*p,axis=1)<=1.0))\nseries=np.empty(200000,dtype=np.float64); series[0]=0.0; noise=rng.normal(size=199999)\nfor i in range(1,200000): series[i]=0.92*series[i-1]+noise[i-1]\nsummary={"ok":True,"task_id":${JSON.stringify(taskId)},"profile":${JSON.stringify(profile)},"accelerator":"cpu","matrix_size":${matrix},"samples":${samples},"pi":pi,"linear_residual":float(np.linalg.norm(S@x-b)),"matrix_checksum":hashlib.sha256(C[:16,:16].tobytes()).hexdigest(),"series_mean":float(series.mean()),"elapsed_s":time.time()-t0}\nopen('/kaggle/working/three-center-result.json','w').write(json.dumps(summary,sort_keys=True))\nprint('THREE_CENTER_RESULT:'+json.dumps(summary,sort_keys=True))`;
}
function makeGpuScript(taskId,profile,input={}){
  const matrix=clamp(input.matrix_size,512,3072,2048),rounds=clamp(input.rounds,1,6,3),seed=clamp(input.seed,1,2_147_483_647,20260815);
  return `import json,time,hashlib\nimport torch, numpy as np\nt0=time.time(); torch.manual_seed(${seed})\nassert torch.cuda.is_available(), 'CUDA_NOT_AVAILABLE'\ndevice=torch.device('cuda'); name=torch.cuda.get_device_name(0)\nA=torch.randn((${matrix},${matrix}),device=device); B=torch.randn((${matrix},${matrix}),device=device)\nC=None\nfor _ in range(${rounds}): C=A@B\ntorch.cuda.synchronize(); sample=C[:16,:16].float().cpu().numpy()\nsub=128; cpu=(A[:sub,:sub].cpu().numpy()@B[:sub,:sub].cpu().numpy()); gpu=(A[:sub,:sub]@B[:sub,:sub]).cpu().numpy(); rel=float(np.linalg.norm(cpu-gpu)/(np.linalg.norm(cpu)+1e-12))\nsummary={"ok":True,"task_id":${JSON.stringify(taskId)},"profile":${JSON.stringify(profile)},"accelerator":"t4","cuda":True,"device":name,"matrix_size":${matrix},"rounds":${rounds},"relative_error":rel,"matrix_checksum":hashlib.sha256(sample.tobytes()).hexdigest(),"allocated_mb":float(torch.cuda.max_memory_allocated()/1048576),"elapsed_s":time.time()-t0}\nopen('/kaggle/working/three-center-result.json','w').write(json.dumps(summary,sort_keys=True))\nprint('THREE_CENTER_RESULT:'+json.dumps(summary,sort_keys=True))`;
}
function scriptFor(task){return task.gpu?makeGpuScript(task.task_id,task.profile,task.input):makeCpuScript(task.task_id,task.profile,task.input)}
export async function dispatch(env,task){
  const who=await introspect(env),kernelSlug=slugify(`three-center-${task.gpu?"t4":"cpu"}-${task.task_id}`),fullSlug=`${who.username}/${kernelSlug}`,title=kernelSlug;
  const body={slug:fullSlug,newTitle:title,text:scriptFor(task),language:"python",kernelType:"script",isPrivate:true,enableGpu:Boolean(task.gpu),enableTpu:false,enableInternet:false,datasetDataSources:[],competitionDataSources:[],kernelDataSources:[],modelDataSources:[],categoryIds:[],sessionTimeoutSeconds:clamp(task.timeout_seconds,60,900,300)};
  if(task.gpu)body.machineShape="NvidiaTeslaT4";
  const saved=await requestJson(env,"kernels.KernelsApiService","SaveKernel",body,30_000);
  return{status:"running",executor:"kaggle-official-api",ref:String(saved?.ref||fullSlug),user_name:who.username,kernel_slug:kernelSlug,version_number:Number(saved?.versionNumber||saved?.version_number||0)||null,url:String(saved?.url||""),gpu:Boolean(task.gpu),machine_shape:task.gpu?"NvidiaTeslaT4":"cpu"};
}
function normalizeStatus(v){if(typeof v==="number")return STATUS_NUM[v]||"running";const k=String(v||"").toUpperCase();return STATUS_STR[k]||String(v||"running").toLowerCase()}
export async function getStatus(env,task){const r=await requestJson(env,"kernels.KernelsApiService","GetKernelSessionStatus",{userName:task.user_name,kernelSlug:task.kernel_slug},15_000);return{status:normalizeStatus(r?.status),failure_message:String(r?.failureMessage||r?.failure_message||"")}}
export async function getOutput(env,task){const r=await requestJson(env,"kernels.KernelsApiService","ListKernelSessionOutput",{userName:task.user_name,kernelSlug:task.kernel_slug,pageSize:50},20_000),log=String(r?.log||"");const lines=log.split(/\r?\n/).filter(x=>x.startsWith("THREE_CENTER_RESULT:"));let result=null;if(lines.length){try{result=JSON.parse(lines.at(-1).slice("THREE_CENTER_RESULT:".length))}catch{}}return{files:Array.isArray(r?.files)?r.files.map(f=>({file_name:String(f?.fileName||f?.file_name||""),url_present:Boolean(f?.url)})):[],log_digest:await digest(log),result}}
export async function removeKernel(env,task){try{await requestJson(env,"kernels.KernelsApiService","DeleteKernel",{userName:task.user_name,kernelSlug:task.kernel_slug},15_000);return true}catch{return false}}
async function digest(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export const officialMeta=()=>({api_base:API_BASE,mcp_endpoint:"https://www.kaggle.com/mcp",bridge_required:false,arbitrary_code:false,machine_shapes:{cpu:"cpu",gpu:"NvidiaTeslaT4"}});