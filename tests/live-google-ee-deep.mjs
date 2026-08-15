const url="https://compute-worker.a15280020511.workers.dev/__diag/google-ee-6fe38386-0a93-4f7c-98c2-b8e2be663b55";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rounds=[];
for(let i=0;i<3;i++){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),120000);
  try{
    const r=await fetch(url,{method:"POST",headers:{accept:"application/json"},signal:c.signal});
    const b=await r.json().catch(()=>null);
    if(r.status!==200||b?.ok!==true||b?.business_e2e!==true||b?.tiny_compute_ok!==true||b?.parallel_requests!==24||b?.parallel_all_correct!==true||b?.geospatial_graph_ok!==true||b?.negative_request_rejected!==true||b?.secret_echo!==false)throw new Error(`GOOGLE_EE_ROUND_${i+1}_FAILED_${r.status}`);
    rounds.push({round:i+1,parallel_requests:24,parallel_http_statuses:b.parallel_http_statuses,elapsed_ms:b.elapsed_ms,negative_http_status:b.negative_http_status});
  }finally{clearTimeout(t)}
  if(i<2)await sleep(1500);
}
console.log(JSON.stringify({ok:true,phase:"google-ee-stability",rounds:3,total_parallel_requests:72,all_rounds_passed:true,geospatial_rounds:3,negative_tests:3,round_details:rounds,secret_echo:false}));