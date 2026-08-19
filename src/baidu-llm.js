const BASE="https://aistudio.baidu.com/llm/lmapi/v3";
const DEFAULT_MODEL="ernie-speed-8k";
const ALLOWED_MODELS=new Set(["ernie-speed-8k","ernie-tiny-8k","ernie-lite-8k"]);
const MAX_INPUT_CHARS=4000;
const MAX_OUTPUT_TOKENS=256;
const TIMEOUT_MS=45000;
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const token=env=>String(env.BAIDU_AISTUDIO_ACCESS_TOKEN||"").trim();

async function timedFetch(url,init={},timeoutMs=TIMEOUT_MS){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:c.signal})}
  catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("BAIDU_LLM_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}
function headers(env){const t=token(env);return{authorization:`Bearer ${t}`,accept:"application/json","content-type":"application/json","user-agent":"three-center-compute/2026-08"}}
function contentOf(body){return String(body?.choices?.[0]?.message?.content||"").trim()}
function usageOf(body){const u=body?.usage||{};return{prompt_tokens:Number(u.prompt_tokens||0),completion_tokens:Number(u.completion_tokens||0),total_tokens:Number(u.total_tokens||0)}}
function safeError(body,status){const raw=String(body?.error?.code||body?.error_code||body?.code||"").slice(0,80);return raw||`BAIDU_LLM_HTTP_${status}`}

export function baiduLLMMeta(env={}){return{
  provider:"baidu-aistudio-llm",
  role:"china-llm-inference",
  integration:"openai-compatible-chat-completions",
  base_url:BASE,
  configured:Boolean(token(env)),
  default_model:DEFAULT_MODEL,
  allowed_models:[...ALLOWED_MODELS],
  max_input_chars:MAX_INPUT_CHARS,
  max_output_tokens:MAX_OUTPUT_TOKENS,
  explicit_selection_only:true,
  automatic_global_routing:false,
  free_quota_available_by_platform_policy:true,
  free_quota_balance_machine_readable:false,
  paid_fallback:false,
  route_eligible:Boolean(token(env)),
  route_scope:"explicit-bounded-inference",
  secret_echo:false
}}

export async function baiduLLMCanary(env={}){
  if(!token(env))return{ok:false,provider:"baidu-aistudio-llm",configured:false,authenticated:false,inference_ok:false,error_class:"BAIDU_AISTUDIO_ACCESS_TOKEN_NOT_CONFIGURED",paid_fallback:false,secret_echo:false};
  const payload={model:DEFAULT_MODEL,messages:[{role:"user",content:"Reply with exactly: 42"}],temperature:0,max_tokens:8,stream:false};
  try{
    const r=await timedFetch(`${BASE}/chat/completions`,{method:"POST",headers:headers(env),body:JSON.stringify(payload)});
    const body=await r.json().catch(()=>({})),text=contentOf(body),usage=usageOf(body),correct=/^42[.!。！]?$/.test(text);
    return{ok:r.ok&&correct,provider:"baidu-aistudio-llm",configured:true,authenticated:r.status!==401&&r.status!==403,inference_ok:r.ok,correct,http_status:r.status,model:DEFAULT_MODEL,usage,content_chars:text.length,error_class:r.ok?(correct?null:"BAIDU_LLM_CANARY_OUTPUT_MISMATCH"):safeError(body,r.status),explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false};
  }catch(e){return{ok:false,provider:"baidu-aistudio-llm",configured:true,authenticated:false,inference_ok:false,http_status:Number(e?.status||0)||null,model:DEFAULT_MODEL,error_class:String(e?.message||"BAIDU_LLM_CANARY_FAILED").slice(0,120),explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false}}
}

async function invoke(req,env){
  if(new URL(req.url).hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"Baidu LLM execution is service-binding internal only",route_eligible:false,secret_echo:false},403);
  if(!token(env))return json({ok:false,error:"BAIDU_AISTUDIO_ACCESS_TOKEN_NOT_CONFIGURED",route_eligible:false,secret_echo:false},503);
  let input={};try{input=await req.json()}catch{return json({ok:false,error:"INVALID_JSON"},400)}
  const model=String(input.model||DEFAULT_MODEL).trim();
  if(!ALLOWED_MODELS.has(model))return json({ok:false,error:"MODEL_NOT_ALLOWED",allowed_models:[...ALLOWED_MODELS]},400);
  let messages=Array.isArray(input.messages)?input.messages:null;
  if(!messages){const prompt=String(input.prompt||"").trim();if(!prompt)return json({ok:false,error:"PROMPT_REQUIRED"},400);messages=[{role:"user",content:prompt}]}
  const clean=[];let chars=0;
  for(const m of messages.slice(0,12)){
    const role=String(m?.role||"");if(!["system","user","assistant"].includes(role))continue;
    const content=String(m?.content||"");chars+=content.length;if(chars>MAX_INPUT_CHARS)return json({ok:false,error:"INPUT_TOO_LARGE",max_input_chars:MAX_INPUT_CHARS},413);
    clean.push({role,content});
  }
  if(!clean.length)return json({ok:false,error:"MESSAGES_REQUIRED"},400);
  const maxTokens=Math.max(2,Math.min(MAX_OUTPUT_TOKENS,Number(input.max_tokens||128)||128));
  const payload={model,messages:clean,temperature:Number.isFinite(Number(input.temperature))?Math.max(0,Math.min(1,Number(input.temperature))):0.2,max_tokens:maxTokens,stream:false};
  try{
    const r=await timedFetch(`${BASE}/chat/completions`,{method:"POST",headers:headers(env),body:JSON.stringify(payload)}),body=await r.json().catch(()=>({}));
    if(!r.ok)return json({ok:false,provider:"baidu-aistudio-llm",http_status:r.status,error:safeError(body,r.status),model,explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false},r.status>=500?502:r.status);
    return json({ok:true,provider:"baidu-aistudio-llm",model,content:contentOf(body),usage:usageOf(body),finish_reason:body?.choices?.[0]?.finish_reason||null,explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false});
  }catch(e){return json({ok:false,provider:"baidu-aistudio-llm",error:String(e?.message||"BAIDU_LLM_FAILED").slice(0,120),explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false},e?.status||502)}
}

export async function maybeHandleBaiduLLM(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu-llm/meta")return json({ok:true,...baiduLLMMeta(env)});
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu-llm/health"){
    if(!token(env))return json({ok:false,...baiduLLMMeta(env),authenticated:false},503);
    try{const r=await timedFetch(`${BASE}/models`,{method:"GET",headers:{authorization:`Bearer ${token(env)}`,accept:"application/json","user-agent":"three-center-compute/2026-08"}},12000);return json({ok:r.ok,provider:"baidu-aistudio-llm",configured:true,authenticated:r.ok,http_status:r.status,route_eligible:r.ok,route_scope:"explicit-bounded-inference",explicit_selection_only:true,automatic_global_routing:false,paid_fallback:false,secret_echo:false},r.ok?200:503)}catch(e){return json({ok:false,provider:"baidu-aistudio-llm",configured:true,authenticated:false,error_class:String(e?.message||"BAIDU_LLM_HEALTH_FAILED"),route_eligible:false,paid_fallback:false,secret_echo:false},503)}
  }
  if(req.method==="GET"&&u.pathname==="/_diag/baidu-llm-C8m4Qa2T"){
    const p=await baiduLLMCanary(env);return json({...p,one_shot:true},p.ok?200:503);
  }
  if(req.method==="POST"&&u.pathname==="/v1/providers/baidu-llm/inference")return invoke(req,env);
  return null;
}
