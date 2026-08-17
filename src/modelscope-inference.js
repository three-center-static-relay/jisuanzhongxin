const API="https://api-inference.modelscope.cn/v1/chat/completions";
const MODEL="Qwen/Qwen3-32B";
const TIMEOUT_MS=30000;
const str=v=>String(v??"").trim();
function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}

export async function modelScopeInferenceCanary(env={}){
  const t=token(env);
  if(!t)return{ok:false,provider:"modelscope",configured:false,authenticated:false,inference_ok:false,error_class:"MODELSCOPE_TOKEN_REQUIRED",free_only:true,paid_fallback:false,secrets_redacted:true};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(API,{method:"POST",headers:{authorization:`Bearer ${t}`,"content-type":"application/json",accept:"application/json"},body:JSON.stringify({model:MODEL,messages:[{role:"user",content:"Calculate 17*19. Return only the integer."}],temperature:0,max_tokens:32,enable_thinking:false,stream:false}),signal:controller.signal});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    const content=str(data?.choices?.[0]?.message?.content);
    const correct=/\b323\b/.test(content);
    return{ok:r.ok&&correct,provider:"modelscope",configured:true,authenticated:r.status!==401&&r.status!==403,inference_ok:r.ok&&correct,http_status:r.status,model:MODEL,expected:"323",correct,content_digest:content?await sha256(content):null,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:r.ok?(correct?null:"UNEXPECTED_RESULT"):`MODELSCOPE_INFERENCE_HTTP_${r.status}`};
  }catch(e){return{ok:false,provider:"modelscope",configured:true,authenticated:false,inference_ok:false,http_status:e?.name==="AbortError"?504:null,model:MODEL,expected:"323",correct:false,content_digest:null,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:e?.name==="AbortError"?"MODELSCOPE_INFERENCE_TIMEOUT":str(e?.message)||"MODELSCOPE_INFERENCE_FAILED"}}
  finally{clearTimeout(timer)}
}

async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
