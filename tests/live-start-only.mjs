const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-live-41d820f5-4211-47dc-bf08-0b5316d602ae";
const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"cpu_start"}),signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==202||!b?.task_id) throw new Error(`KAGGLE_CPU_START_PHASE_FAILED_HTTP_${r.status}`);
  console.log(JSON.stringify({ok:true,phase:"kaggle-real-cpu-start",status:r.status,task_id_present:true}));
} finally { clearTimeout(t); }
