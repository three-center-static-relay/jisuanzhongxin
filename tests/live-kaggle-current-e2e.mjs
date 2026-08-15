const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-current-accept-20260815-7b4f29d1";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(action,task_id){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action,task_id}),signal:c.signal});
    return {status:r.status,body:await r.json().catch(()=>null)};
  }finally{clearTimeout(t)}
}
async function runOne({taskId,profile,accelerator,maxPolls}){
  const start=await post("start",taskId);
  if(!(start.status===200&&start.body?.status_code===202&&start.body?.status==="running"))throw new Error(`KAGGLE_${accelerator.toUpperCase()}_START_FAILED:${JSON.stringify(start.body)}`);
  let last=null;
  for(let i=0;i<maxPolls;i++){
    await sleep(i===0?4000:10000);
    last=await post("status",taskId);
    const inner=last.body?.body;
    if(last.status===200&&last.body?.status_code===202&&["queued","running","cancel_requested"].includes(String(inner?.status||"")))continue;
    if(last.status===200&&last.body?.status_code===200&&inner?.status==="completed"){
      const r=inner.result;
      if(inner?.verification?.ok!==true||inner?.temporary_kernel_deleted!==true||!inner?.result_digest||r?.task_id!==taskId||r?.profile!==profile||r?.accelerator!==accelerator)throw new Error(`KAGGLE_${accelerator.toUpperCase()}_RESULT_INVALID:${JSON.stringify({verification:inner?.verification,cleanup:inner?.temporary_kernel_deleted,result_digest:inner?.result_digest,result:r,output_retrieval:inner?.output_retrieval})}`);
      if(accelerator==="cpu"&&(!(Number(r?.pi)>3.10&&Number(r?.pi)<3.18)||!(Number(r?.linear_residual)<=1e-6)))throw new Error(`KAGGLE_CPU_NUMERIC_INVALID:${JSON.stringify(r)}`);
      if(accelerator==="t4"&&(r?.cuda!==true||!/t4/i.test(String(r?.device||""))||!(Number(r?.relative_error)<=0.05)))throw new Error(`KAGGLE_T4_NUMERIC_INVALID:${JSON.stringify(r)}`);
      if(!["log-marker","output-file"].includes(String(inner?.output_retrieval?.source||"")))throw new Error(`KAGGLE_${accelerator.toUpperCase()}_RETRIEVAL_SOURCE_INVALID:${JSON.stringify(inner?.output_retrieval)}`);
      return {task_id:taskId,accelerator,result_digest:inner.result_digest,source:inner.output_retrieval.source,device:r?.device||null,pi:r?.pi||null,relative_error:r?.relative_error||null};
    }
    throw new Error(`KAGGLE_${accelerator.toUpperCase()}_TERMINAL_FAILED:${JSON.stringify(last.body)}`);
  }
  throw new Error(`KAGGLE_${accelerator.toUpperCase()}_POLL_TIMEOUT:${JSON.stringify(last?.body)}`);
}
const cpu=await runOne({taskId:"live-current-cpu-20260815a",profile:"core",accelerator:"cpu",maxPolls:60});
const t4=await runOne({taskId:"live-current-t4-20260815a",profile:"gpu",accelerator:"t4",maxPolls:90});
console.log(JSON.stringify({ok:true,phase:"current-kaggle-cpu-t4-e2e",cpu,t4,verification_ok:true,temporary_kernel_deleted:true,result_digest_present:true}));
