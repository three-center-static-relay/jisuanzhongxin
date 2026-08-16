const PROVIDER="modal";
const MODEL="baolong-milk-tea-v1";
function cleanBaseUrl(v){return String(v||"").trim().replace(/\/+$/g,"")}
function validHttpsUrl(v){try{const u=new URL(v);return u.protocol==="https:"}catch{return false}}
function headers(id,secret){return {"Modal-Key":id,"Modal-Secret":secret,"Accept":"application/json","Content-Type":"application/json"}}

export async function runBaolongBusinessBenchmark(env,{iterations=1000000,seed=20260816}={}){
  const endpoint=cleanBaseUrl(env.MODAL_ENDPOINT_URL);
  const id=String(env.MODAL_PROXY_TOKEN_ID||"").trim();
  const secret=String(env.MODAL_PROXY_TOKEN_SECRET||"").trim();
  if(!endpoint||!id||!secret||!validHttpsUrl(endpoint)||!/^wk-[A-Za-z0-9_-]+$/.test(id)||!/^ws-[A-Za-z0-9_-]+$/.test(secret)){
    return {ok:false,provider:PROVIDER,error:"MODAL_BRIDGE_CONFIG_INVALID",model:MODEL,secret_echo:false};
  }
  if(!Number.isInteger(iterations)||iterations<10000||iterations>1000000)return {ok:false,provider:PROVIDER,error:"INVALID_ITERATIONS",allowed_range:[10000,1000000],model:MODEL,secret_echo:false};
  if(!Number.isInteger(seed)||seed<0||seed>2147483647)return {ok:false,provider:PROVIDER,error:"INVALID_SEED",model:MODEL,secret_echo:false};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),110000);
  try{
    const started=Date.now();
    const r=await fetch(`${endpoint}/v1/benchmark/business-monte-carlo`,{method:"POST",headers:headers(id,secret),body:JSON.stringify({model:MODEL,iterations,seed}),signal:controller.signal});
    let upstream=null;try{upstream=await r.json()}catch{upstream=null}
    const structurallyValid=Boolean(r.ok&&upstream?.ok===true&&upstream?.model===MODEL&&upstream?.accelerator==="cpu"&&Number(upstream?.iterations)===iterations&&Number(upstream?.seed)===seed&&typeof upstream?.result_signature_sha256==="string"&&upstream.result_signature_sha256.length===64);
    return {
      ok:structurallyValid,
      provider:PROVIDER,
      benchmark:"business-monte-carlo",
      model:MODEL,
      bridge_http_status:r.status,
      iterations,
      seed,
      accelerator:"cpu",
      cpu_preferred:true,
      mean_monthly_profit_cny:upstream?.mean_monthly_profit_cny??null,
      median_monthly_profit_cny_approx:upstream?.median_monthly_profit_cny_approx??null,
      p10_monthly_profit_cny_approx:upstream?.p10_monthly_profit_cny_approx??null,
      p90_monthly_profit_cny_approx:upstream?.p90_monthly_profit_cny_approx??null,
      profitable_probability:upstream?.profitable_probability??null,
      profit_above_10k_probability:upstream?.profit_above_10k_probability??null,
      loss_below_minus_10k_probability:upstream?.loss_below_minus_10k_probability??null,
      quantile_sample_size:upstream?.quantile_sample_size??null,
      modal_elapsed_ms:upstream?.elapsed_ms??null,
      iterations_per_second:upstream?.iterations_per_second??null,
      roundtrip_elapsed_ms:Date.now()-started,
      result_signature_sha256:upstream?.result_signature_sha256??null,
      parameters:upstream?.parameters??null,
      route_eligible:true,
      route_scope:"bounded-compute",
      routing_policy:"cpu-first",
      paid_fallback:false,
      free_credit_only:true,
      secret_echo:false,
      acceptance_state:structurallyValid?"business-benchmark-pass":"business-benchmark-failed"
    };
  }catch(e){
    return {ok:false,provider:PROVIDER,benchmark:"business-monte-carlo",model:MODEL,error:e?.name==="AbortError"?"MODAL_BUSINESS_BENCHMARK_TIMEOUT":"MODAL_BUSINESS_BENCHMARK_UNAVAILABLE",route_eligible:true,route_scope:"bounded-compute",routing_policy:"cpu-first",paid_fallback:false,free_credit_only:true,secret_echo:false,acceptance_state:"business-benchmark-failed"};
  }finally{clearTimeout(timer)}
}
