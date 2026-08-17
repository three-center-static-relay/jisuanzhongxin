const API="https://api-inference.modelscope.cn/v1/chat/completions";
const MODEL="Qwen/Qwen3.5-27B";
const CANARY_REVISION="qwen3.5-27b-stream-math-v3-20260817";
const TIMEOUT_MS=45000;
const str=v=>String(v??"").trim();
function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}

function parseSse(raw){
  let content="",reasoning="",events=0;
  for(const line of String(raw||"").split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed.startsWith("data:"))continue;
    const payload=trimmed.slice(5).trim();
    if(!payload||payload==="[DONE]")continue;
    try{
      const data=JSON.parse(payload),delta=data?.choices?.[0]?.delta||{};
      if(typeof delta.content==="string")content+=delta.content;
      if(typeof delta.reasoning_content==="string")reasoning+=delta.reasoning_content;
      events+=1;
    }catch{}
  }
  return{content,reasoning,events};
}

export async function modelScopeInferenceCanary(env={}){
  const t=token(env);
  if(!t)return{ok:false,provider:"modelscope",configured:false,authenticated:false,inference_ok:false,canary_revision:CANARY_REVISION,error_class:"MODELSCOPE_TOKEN_REQUIRED",free_only:true,paid_fallback:false,secrets_redacted:true};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(API,{method:"POST",headers:{authorization:`Bearer ${t}`,"content-type":"application/json",accept:"text/event-stream"},body:JSON.stringify({model:MODEL,messages:[{role:"user",content:[{type:"text",text:"Calculate 17*19. Return only the integer result."}]}],temperature:0,max_tokens:256,stream:true}),signal:controller.signal});
    const raw=await r.text(),parsed=parseSse(raw),combined=`${parsed.reasoning}\n${parsed.content}`;
    const correct=/\b323\b/.test(combined);
    const responseDigest=raw?await sha256(raw):null;
    const outputDigest=combined.trim()?await sha256(combined):null;
    const errorClass=!r.ok?`MODELSCOPE_INFERENCE_HTTP_${r.status}`:parsed.events===0?"EMPTY_SSE_STREAM":correct?null:"UNEXPECTED_RESULT";
    return{ok:r.ok&&parsed.events>0&&correct,provider:"modelscope",configured:true,authenticated:r.status!==401&&r.status!==403,inference_ok:r.ok&&parsed.events>0&&correct,http_status:r.status,model:MODEL,canary_revision:CANARY_REVISION,response_mode:"sse-stream",stream_events:parsed.events,content_chars:parsed.content.length,reasoning_chars:parsed.reasoning.length,response_digest:responseDigest,output_digest:outputDigest,expected:"323",correct,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:errorClass};
  }catch(e){return{ok:false,provider:"modelscope",configured:true,authenticated:false,inference_ok:false,http_status:e?.name==="AbortError"?504:null,model:MODEL,canary_revision:CANARY_REVISION,response_mode:"sse-stream",stream_events:0,content_chars:0,reasoning_chars:0,response_digest:null,output_digest:null,expected:"323",correct:false,free_only:true,paid_fallback:false,secrets_redacted:true,error_class:e?.name==="AbortError"?"MODELSCOPE_INFERENCE_TIMEOUT":str(e?.message)||"MODELSCOPE_INFERENCE_FAILED"}}
  finally{clearTimeout(timer)}
}

async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
