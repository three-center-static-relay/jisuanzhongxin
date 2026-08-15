const url="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-sdk-receipt-943376c8-184c-486b-8911-f05abe2c398e";
const expected=String(process.argv[2]||"");
const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200)throw new Error(`RECEIPT_HTTP_${r.status}`);
  const reason=String(b?.verification?.reason||"");
  if(expected==="FAILED"&&b?.status!=="failed")throw new Error(`STATUS_NOT_FAILED:${b?.status}`);
  else if(expected!=="FAILED"&&reason!==expected)throw new Error(`REASON_MISMATCH:${reason}`);
  console.log(JSON.stringify({ok:true,phase:"kaggle-receipt-classifier",status:b?.status||null,reason:reason||null,cleanup:b?.temporary_kernel_deleted===true,digest:b?.result_digest_present===true,secret_echo:false}));
}finally{clearTimeout(t)}