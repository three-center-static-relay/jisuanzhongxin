const base="https://compute-worker.a15280020511.workers.dev";
const c=new AbortController();const t=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(`${base}/health`,{headers:{accept:"application/json"},signal:c.signal});
  if(!r.ok)throw new Error(`WORKER_HEALTH_HTTP_${r.status}`);
  const b=await r.json();
  if(b?.ok!==true||b?.service!=="compute-worker")throw new Error("WORKER_HEALTH_INVALID");
  console.log(JSON.stringify({ok:true,phase:"compute-production-health",service:b.service,api_version:b.api_version,kaggle:b.kaggle||null}));
}finally{clearTimeout(t)}