const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-sdk-mirror-58b8b2cc-8b47-4e44-95d2-b2c4d899ab92";
const taskId="live-sdk-t4-mirror-001";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(action){const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);try{const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action,task_id:taskId}),signal:c.signal});return{status:r.status,body:await r.json().catch(()=>null)}}finally{clearTimeout(t)}}
const start=await post("start");
const started=start.status===200&&start.body?.ok===true&&start.body?.status_code===202&&start.body?.status==="running"&&start.body?.machine_shape==="NvidiaTeslaT4";
const existing=start.status===200&&start.body?.status_code===409&&["DUPLICATE_TASK","BUSY"].includes(String(start.body?.error||""));
if(!started&&!existing)throw new Error(`KAGGLE_T4_START_FAILED:${JSON.stringify(start.body)}`);
let last=null;
for(let i=0;i<90;i++){
  await sleep(i===0?5000:10000);
  last=await post("status");
  const inner=last.body?.body;
  if(last.status===200&&last.body?.status_code===202&&["queued","running","cancel_requested"].includes(String(inner?.status||"")))continue;
  if(last.status===200&&last.body?.status_code===200&&inner?.status==="completed"){
    const r=inner.result;
    if(inner?.verification?.ok!==true||inner?.temporary_kernel_deleted!==true||r?.task_id!==taskId||r?.profile!=="gpu"||r?.accelerator!=="t4"||r?.cuda!==true||!/t4/i.test(String(r?.device||""))||!(Number(r?.relative_error)<=0.05))throw new Error(`KAGGLE_T4_RESULT_INVALID:${JSON.stringify({verification:inner?.verification,cleanup:inner?.temporary_kernel_deleted,result:r})}`);
    const receipt=await post("status"),stored=receipt.body?.body;
    if(stored?.status!=="completed"||stored?.verification?.ok!==true||stored?.temporary_kernel_deleted!==true||!stored?.result_digest)throw new Error(`KAGGLE_T4_RECEIPT_INVALID:${JSON.stringify(stored)}`);
    console.log(JSON.stringify({ok:true,phase:"real-kaggle-t4-e2e",task_id:taskId,status:"completed",started_now:started,device:r.device,relative_error:r.relative_error,allocated_mb:r.allocated_mb,verification_ok:true,temporary_kernel_deleted:true,result_digest_present:true}));
    process.exit(0);
  }
  throw new Error(`KAGGLE_T4_TERMINAL_FAILED:${JSON.stringify(last.body)}`);
}
throw new Error(`KAGGLE_T4_POLL_TIMEOUT:${JSON.stringify(last?.body)}`);