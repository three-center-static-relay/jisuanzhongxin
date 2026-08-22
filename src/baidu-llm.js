const json=(body,status=410)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const RETIRED=Object.freeze({
  ok:false,
  provider:"baidu-aistudio-llm",
  status:"retired-model-source",
  error:"MODEL_SOURCE_NOT_APPROVED",
  approved_sources:["workers-ai","openrouter","huggingface"],
  route_eligible:false,
  inference_ok:false,
  automatic_global_routing:false,
  paid_fallback:false,
  secret_echo:false,
  secrets_redacted:true
});

export function baiduLLMMeta(){return{...RETIRED,configured:false}}
export async function baiduLLMCanary(){return{...RETIRED,configured:false,authenticated:false}}
export async function maybeHandleBaiduLLM(req){
  const u=new URL(req.url);
  if(u.pathname.startsWith("/v1/providers/baidu-llm/")||u.pathname==="/_diag/baidu-llm-C8m4Qa2T")return json(RETIRED,410);
  return null;
}
