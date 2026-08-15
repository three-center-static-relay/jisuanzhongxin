const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-sdk-mirror-58b8b2cc-8b47-4e44-95d2-b2c4d899ab92";
const taskId="live-sdk-cpu-mirror-001";
const c=new AbortController(),t=setTimeout(()=>c.abort(),45000);
try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"start",task_id:taskId}),signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true||b?.status_code!==202||b?.status!=="running")throw new Error(`KAGGLE_START_FAILED:${b?.status_code||r.status}:${b?.error||"unknown"}:${String(b?.message||"").slice(0,180)}`);
  console.log(JSON.stringify({ok:true,phase:"real-kaggle-sdk-start",task_id:taskId,status_code:202,status:"running",secret_echo:false}));
}finally{clearTimeout(t)}