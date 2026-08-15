const url="https://compute-worker.a15280020511.workers.dev/__diag/google-ee-6fe38386-0a93-4f7c-98c2-b8e2be663b55";
const c=new AbortController(),t=setTimeout(()=>c.abort(),120000);
try{
  const r=await fetch(url,{method:"POST",headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true||b?.business_e2e!==true||b?.tiny_compute_ok!==true||b?.parallel_requests!==24||b?.parallel_all_correct!==true||b?.geospatial_graph_ok!==true||b?.negative_request_rejected!==true||b?.secret_echo!==false)throw new Error(`GOOGLE_EE_DEEP_FAILED_${r.status}`);
  console.log(JSON.stringify({ok:true,phase:"google-ee-deep",tiny_compute_ok:true,parallel_requests:24,parallel_all_correct:true,parallel_http_statuses:b.parallel_http_statuses,geospatial_graph_ok:true,negative_request_rejected:true,negative_http_status:b.negative_http_status,elapsed_ms:b.elapsed_ms,secret_echo:false}));
}finally{clearTimeout(t)}