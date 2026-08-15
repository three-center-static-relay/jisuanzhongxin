const url="https://compute-worker.a15280020511.workers.dev/v1/providers/google-ee/health";
const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true||b?.configured!==true||b?.oauth!==true||b?.secret_echo!==false)throw new Error(`GOOGLE_EE_HEALTH_FAILED_${r.status}`);
  console.log(JSON.stringify({ok:true,phase:"google-ee-health",configured:true,oauth:true,registration_state:b.registration_state||"UNKNOWN",secret_echo:false}));
}finally{clearTimeout(t)}