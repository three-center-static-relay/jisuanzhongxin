const PROVIDER="modal";
const MAX_VALUES=4096;
function cleanBaseUrl(v){return String(v||"").trim().replace(/\/+$/g,"")}
function validHttpsUrl(v){try{const u=new URL(v);return u.protocol==="https:"}catch{return false}}
function authHeaders(id,secret){return {"Modal-Key":id,"Modal-Secret":secret,"Accept":"application/json","Content-Type":"application/json"}}

export async function modalBoundedCompute(env,{op,values}={}){
  const endpoint=cleanBaseUrl(env.MODAL_ENDPOINT_URL);
  const id=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const secret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  if(!endpoint||!id||!secret||!validHttpsUrl(endpoint)||!/^wk-[A-Za-z0-9_-]+$/.test(id)||!/^ws-[A-Za-z0-9_-]+$/.test(secret)){
    return {ok:false,http_status:503,provider:PROVIDER,error:"MODAL_BRIDGE_CONFIG_INVALID",secret_echo:false};
  }
  op=String(op||"").trim().toLowerCase();
  if(!["sum","mean"].includes(op))return {ok:false,http_status:400,provider:PROVIDER,error:"UNSUPPORTED_OP",allowed:["sum","mean"],secret_echo:false};
  if(!Array.isArray(values)||values.length>MAX_VALUES||(op==="mean"&&values.length===0))return {ok:false,http_status:400,provider:PROVIDER,error:"INVALID_VALUES",max_values:MAX_VALUES,secret_echo:false};
  if(!values.every(v=>typeof v==="number"&&Number.isFinite(v)))return {ok:false,http_status:400,provider:PROVIDER,error:"NONFINITE_VALUE",secret_echo:false};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),35000);
  try{
    const started=Date.now();
    const r=await fetch(`${endpoint}/v1/compute`,{method:"POST",headers:authHeaders(id,secret),body:JSON.stringify({op,values}),signal:controller.signal});
    let upstream=null;try{upstream=await r.json()}catch{}
    const result=Number(upstream?.result);
    const ok=Boolean(r.ok&&upstream?.ok===true&&upstream?.op===op&&Number.isFinite(result));
    return {ok,http_status:ok?200:(r.status||502),provider:PROVIDER,op,count:values.length,result:ok?result:null,accelerator:"cpu",routing_policy:"cpu-first",transient_input:true,task_persisted:false,paid_fallback:false,free_credit_only:true,roundtrip_elapsed_ms:Date.now()-started,secret_echo:false};
  }catch(e){
    return {ok:false,http_status:503,provider:PROVIDER,error:e?.name==="AbortError"?"MODAL_COMPUTE_TIMEOUT":"MODAL_COMPUTE_UNAVAILABLE",op,count:Array.isArray(values)?values.length:0,accelerator:"cpu",transient_input:true,task_persisted:false,paid_fallback:false,free_credit_only:true,secret_echo:false};
  }finally{clearTimeout(timer)}
}
