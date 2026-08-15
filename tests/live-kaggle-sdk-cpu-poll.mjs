const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-sdk-mirror-58b8b2cc-8b47-4e44-95d2-b2c4d899ab92";
const taskId="live-sdk-cpu-mirror-001";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=null;
for(let i=0;i<60;i++){
  if(i>0)await sleep(10000);
  const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"status",task_id:taskId}),signal:c.signal});
    last=await r.json().catch(()=>null);
  }finally{clearTimeout(t)}
  const inner=last?.body;
  if(last?.status_code===202&&["queued","running","cancel_requested"].includes(String(inner?.status||"")))continue;
  if(last?.status_code===200&&inner?.status==="completed"){
    if(inner?.verification?.ok!==true||inner?.temporary_kernel_deleted!==true||!inner?.result_digest)throw new Error(`KAGGLE_CPU_RECEIPT_INVALID:${JSON.stringify({verification:inner?.verification,cleanup:inner?.temporary_kernel_deleted,digest:Boolean(inner?.result_digest)})}`);
    console.log(JSON.stringify({ok:true,phase:"real-kaggle-cpu-e2e",task_id:taskId,status:"completed",verification_ok:true,temporary_kernel_deleted:true,result_digest_present:true}));
    process.exit(0);
  }
  throw new Error(`KAGGLE_CPU_TERMINAL_FAILED:${last?.status_code}:${JSON.stringify(inner)}`);
}
throw new Error(`KAGGLE_CPU_POLL_TIMEOUT:${JSON.stringify(last)}`);