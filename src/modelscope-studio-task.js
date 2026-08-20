const OPENAPI="https://modelscope.cn/openapi/v1";
const REPO_NAME="three-center-cpu-lite";
const TASK_VAR="THREE_CENTER_TASK_JSON";
const TASK_REVISION="studio-lite-task-v1-20260820";
const TASK_MARKER="THREE_CENTER_MODELSCOPE_TASK:";
const MAX_TASK_BYTES=24576;
const str=v=>String(v??"").trim();

function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}
function headers(t,json=true){const h={authorization:`Bearer ${t}`,accept:"application/json"};if(json)h["content-type"]="application/json";return h}
async function req(url,{method="GET",headers:h={},body=null,timeout=20000}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{method,headers:h,body:body===null?undefined:JSON.stringify(body),signal:c.signal});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}return{ok:r.ok,status:r.status,data,text:text.slice(0,2048)}}
  catch(e){return{ok:false,status:e?.name==="AbortError"?504:0,error:e?.name==="AbortError"?"TIMEOUT":str(e?.message)||"FETCH_FAILED",data:null,text:""}}
  finally{clearTimeout(timer)}
}
function payload(x){return x?.data?.data??x?.data??x}
function objects(v,out=[]){if(out.length>512)return out;if(Array.isArray(v)){for(const x of v)objects(x,out)}else if(v&&typeof v==="object"){out.push(v);for(const x of Object.values(v))objects(x,out)}return out}
function strings(v,out=[]){if(out.length>4096)return out;if(typeof v==="string")out.push(v);else if(Array.isArray(v)){for(const x of v)strings(x,out)}else if(v&&typeof v==="object"){for(const x of Object.values(v))strings(x,out)}return out}
function username(raw){for(const o of objects(raw)){for(const k of ["Username","username","preferred_username","user_name","userName","name"]){const v=str(o?.[k]);if(v&&/^[A-Za-z0-9_.-]{1,80}$/.test(v))return v}}return null}
function finite(n){return typeof n==="number"&&Number.isFinite(n)}
function numberArray(v,max){return Array.isArray(v)&&v.length>0&&v.length<=max&&v.every(finite)}
function matrix(v,max=24){return Array.isArray(v)&&v.length>0&&v.length<=max&&v.every(r=>numberArray(r,max))&&v.every(r=>r.length===v[0].length)}
function taskSize(task){return new TextEncoder().encode(JSON.stringify(task)).length}

export function normalizeModelScopeLiteTask(raw={},taskId=""){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return{ok:false,error:"TASK_OBJECT_REQUIRED"};
  const id=str(taskId||raw.task_id);if(!/^[A-Za-z0-9_][A-Za-z0-9_-]{5,99}$/.test(id))return{ok:false,error:"INVALID_TASK_ID"};
  const op=str(raw.op).toLowerCase();let task={task_id:id,op};
  if(op==="sum"||op==="stats"){
    if(!numberArray(raw.values,2000))return{ok:false,error:"VALUES_REQUIRED_OR_TOO_LARGE"};task.values=raw.values;
  }else if(op==="dot"){
    if(!numberArray(raw.a,1024)||!numberArray(raw.b,1024)||raw.a.length!==raw.b.length)return{ok:false,error:"DOT_VECTOR_SHAPE_INVALID"};task.a=raw.a;task.b=raw.b;
  }else if(op==="matmul"){
    if(!matrix(raw.a)||!matrix(raw.b)||raw.a[0].length!==raw.b.length)return{ok:false,error:"MATRIX_SHAPE_INVALID"};task.a=raw.a;task.b=raw.b;
  }else if(op==="linear_regression"){
    if(!numberArray(raw.x,1000)||!numberArray(raw.y,1000)||raw.x.length!==raw.y.length||raw.x.length<2)return{ok:false,error:"REGRESSION_INPUT_INVALID"};task.x=raw.x;task.y=raw.y;
  }else if(op==="monte_carlo_pi"){
    const samples=Number(raw.samples),seed=Number(raw.seed??12345);if(!Number.isInteger(samples)||samples<1000||samples>2000000||!Number.isInteger(seed)||seed<0||seed>2147483647)return{ok:false,error:"MONTE_CARLO_INPUT_INVALID"};task.samples=samples;task.seed=seed;
  }else return{ok:false,error:"UNSUPPORTED_TASK_OP",allowed:["sum","stats","dot","matmul","linear_regression","monte_carlo_pi"]};
  if(taskSize(task)>MAX_TASK_BYTES)return{ok:false,error:"TASK_TOO_LARGE",max_bytes:MAX_TASK_BYTES};
  return{ok:true,task};
}

async function identity(env={}){
  const t=token(env);if(!t)return{ok:false,configured:false,error_class:"MODELSCOPE_TOKEN_REQUIRED"};
  const me=await req(`${OPENAPI}/users/me`,{headers:headers(t,false)}),owner=me.ok?username(payload(me)):null;
  return me.ok&&owner?{ok:true,configured:true,authenticated:true,token:t,owner}:{ok:false,configured:true,authenticated:me.status!==401&&me.status!==403,error_class:!me.ok?`MODELSCOPE_IDENTITY_HTTP_${me.status}`:"MODELSCOPE_OWNER_UNRESOLVED"};
}
function hasVariable(raw,key){for(const o of objects(raw)){const k=str(o?.key||o?.Key||o?.name||o?.Name);if(k===key)return true}return false}
async function variableRequest(t,owner,method,body){return req(`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}/variables`,{method,headers:headers(t),body,timeout:15000})}

export async function setModelScopeStudioLiteTask(env={},task){
  const normalized=normalizeModelScopeLiteTask(task,task?.task_id);if(!normalized.ok)return{ok:false,stage:"task-validate",error_class:normalized.error,free_only:true,paid_fallback:false,secrets_redacted:true};
  const id=await identity(env);if(!id.ok)return{ok:false,stage:"identity",error_class:id.error_class,free_only:true,paid_fallback:false,secrets_redacted:true};
  const list=await variableRequest(id.token,id.owner,"GET",null);if(!list.ok)return{ok:false,stage:"variable-list",http_status:list.status,error_class:`MODELSCOPE_VARIABLE_LIST_HTTP_${list.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
  const exists=hasVariable(list.data,TASK_VAR),value=JSON.stringify(normalized.task);
  const write=await variableRequest(id.token,id.owner,exists?"PUT":"POST",{key:TASK_VAR,value});
  return{ok:write.ok,stage:write.ok?"task-injected":"task-inject-failed",http_status:write.status,task_id:normalized.task.task_id,op:normalized.task.op,variable_action:exists?"update":"add",error_class:write.ok?null:`MODELSCOPE_TASK_VARIABLE_HTTP_${write.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
}

export async function clearModelScopeStudioLiteTask(env={}){
  const id=await identity(env);if(!id.ok)return{ok:false,stage:"identity",error_class:id.error_class,free_only:true,paid_fallback:false,secrets_redacted:true};
  const list=await variableRequest(id.token,id.owner,"GET",null);if(!list.ok)return{ok:false,stage:"variable-list",http_status:list.status,error_class:`MODELSCOPE_VARIABLE_LIST_HTTP_${list.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
  if(!hasVariable(list.data,TASK_VAR))return{ok:true,stage:"task-variable-absent",deleted:false,free_only:true,paid_fallback:false,secrets_redacted:true};
  const del=await variableRequest(id.token,id.owner,"DELETE",{key:TASK_VAR});
  return{ok:del.ok,stage:del.ok?"task-variable-cleared":"task-variable-clear-failed",deleted:del.ok,http_status:del.status,error_class:del.ok?null:`MODELSCOPE_TASK_VARIABLE_DELETE_HTTP_${del.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
}

function parseTaskReceipt(raw,taskId){for(const s of strings(raw)){for(const line of s.split(/\r?\n/)){const i=line.indexOf(TASK_MARKER);if(i<0)continue;try{const x=JSON.parse(line.slice(i+TASK_MARKER.length).trim());if(x?.revision===TASK_REVISION&&x?.task_id===taskId)return x}catch{}}}return null}
function cleanResult(v,depth=0){if(depth>4)return null;if(v===null||typeof v==="boolean"||typeof v==="string")return typeof v==="string"?v.slice(0,160):v;if(typeof v==="number")return Number.isFinite(v)?v:null;if(Array.isArray(v))return v.slice(0,1024).map(x=>cleanResult(x,depth+1));if(v&&typeof v==="object"){const out={};for(const [k,x] of Object.entries(v).slice(0,32))out[String(k).slice(0,64)]=cleanResult(x,depth+1);return out}return null}
function cleanReceipt(x){if(!x)return null;return{ok:x.ok===true,revision:str(x.revision),task_id:str(x.task_id),op:str(x.op),result:cleanResult(x.result),result_digest:/^[a-f0-9]{64}$/i.test(str(x.result_digest))?str(x.result_digest):null,elapsed_s:Number(x.elapsed_s||0),error_class:x.error_class?str(x.error_class).slice(0,100):null}}

export async function getModelScopeStudioLiteTaskStatus(env={},taskId=""){
  const idValue=str(taskId);if(!/^[A-Za-z0-9_][A-Za-z0-9_-]{5,99}$/.test(idValue))return{ok:false,error_class:"INVALID_TASK_ID",task_id:null,free_only:true,paid_fallback:false,secrets_redacted:true};
  const id=await identity(env);if(!id.ok)return{ok:false,error_class:id.error_class,task_id:idValue,free_only:true,paid_fallback:false,secrets_redacted:true};
  const logs=await req(`${OPENAPI}/studios/${encodeURIComponent(id.owner)}/${encodeURIComponent(REPO_NAME)}/logs/run?page_num=1&page_size=100`,{headers:headers(id.token,false),timeout:15000});
  if(!logs.ok)return{ok:false,task_id:idValue,log_http_status:logs.status,error_class:`MODELSCOPE_STUDIO_LOG_HTTP_${logs.status}`,free_only:true,paid_fallback:false,secrets_redacted:true};
  const receipt=parseTaskReceipt(payload(logs),idValue),done=Boolean(receipt);
  return{ok:done&&receipt?.ok===true,completed:done,task_id:idValue,task_receipt:cleanReceipt(receipt),log_http_status:logs.status,error_class:done?(receipt?.ok===true?null:(receipt?.error_class||"MODELSCOPE_TASK_FAILED")):"MODELSCOPE_TASK_RECEIPT_PENDING",free_only:true,paid_fallback:false,secrets_redacted:true};
}

export const modelScopeStudioTaskMeta=()=>({provider:"modelscope-studio-lite",task_revision:TASK_REVISION,task_variable:TASK_VAR,allowed_ops:["sum","stats","dot","matmul","linear_regression","monte_carlo_pi"],max_task_bytes:MAX_TASK_BYTES,arbitrary_code:false,network_task_input:false,free_only:true,paid_fallback:false});
