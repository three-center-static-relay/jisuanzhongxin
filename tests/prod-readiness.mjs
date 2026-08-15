const base="https://compute-worker.a15280020511.workers.dev";
const c=new AbortController();const t=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(`${base}/health`,{headers:{accept:"application/json"},signal:c.signal});
  if(!r.ok)throw new Error(`WORKER_HEALTH_HTTP_${r.status}`);
  const b=await r.json();
  if(b?.ok!==true||b?.service!=="compute-worker")throw new Error("WORKER_HEALTH_INVALID");
  if(b?.kaggle?.kaggle_api_token_configured!==true)throw new Error("KAGGLE_API_TOKEN_NOT_CONFIGURED");
  console.log(JSON.stringify({ok:true,phase:"compute-production-kaggle-token",kaggle_api_token_configured:true}));
}finally{clearTimeout(t)}