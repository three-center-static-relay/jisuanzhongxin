const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/baidu-native-accept-20260815-84d2f6c7";
const taskId="baidu-native-smoke-20260815a";
const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"start",task_id:taskId}),signal:c.signal});
  const b=await r.json().catch(()=>null);
  const ok=r.status===200&&b?.ok===true&&b?.task_id===taskId&&Boolean(b?.pipeline_id)&&String(b?.payment_mode||"coupon")==="coupon"&&b?.secret_echo===false;
  const existing=r.status===200&&b?.ok===true&&b?.existing===true&&b?.task_id===taskId&&Boolean(b?.pipeline_id)&&b?.secret_echo===false;
  if(!ok&&!existing)throw new Error(`BAIDU_NATIVE_START_FAILED:${r.status}:${JSON.stringify({ok:b?.ok,existing:b?.existing,error_class:b?.error_class,http_status:b?.http_status,status:b?.status,stage:b?.stage,pipeline_id_present:Boolean(b?.pipeline_id),secret_echo:b?.secret_echo})}`);
  console.log(JSON.stringify({ok:true,phase:"baidu-native-start",task_id:taskId,pipeline_id_present:true,existing:Boolean(b?.existing),stage:b?.stage||b?.status||null,payment_mode:b?.payment_mode||"coupon",secret_echo:false}));
}finally{clearTimeout(timer)}
