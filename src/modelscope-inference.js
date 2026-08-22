const RETIRED=Object.freeze({
  ok:false,
  provider:"modelscope",
  status:"retired-model-source",
  configured:false,
  authenticated:false,
  inference_ok:false,
  model:null,
  error_class:"MODEL_SOURCE_NOT_APPROVED",
  approved_sources:["workers-ai","openrouter","huggingface"],
  free_only:true,
  paid_fallback:false,
  secrets_redacted:true
});

export async function modelScopeInferenceCanary(){return{...RETIRED}}
