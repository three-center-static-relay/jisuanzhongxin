const endpoint="https://compute-worker.a15280020511.workers.dev/v1/providers/baidu/health";
const c=new AbortController(),timer=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(endpoint,{method:"GET",headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true||b?.configured!==true||b?.token_present!==true||b?.authenticated!==true||b?.authentication_tested!==true||b?.manual_ready!==true||b?.secret_echo!==false)throw new Error(`BAIDU_HEALTH_ACCEPTANCE_FAILED:${r.status}:${JSON.stringify({ok:b?.ok,configured:b?.configured,token_present:b?.token_present,authenticated:b?.authenticated,authentication_tested:b?.authentication_tested,manual_ready:b?.manual_ready,reason:b?.reason,secret_echo:b?.secret_echo})}`);
  if(b?.payment_mode!=="coupon"||b?.acoin_allowed!==false||b?.paid_fallback!==false||b?.daily_maintenance_required!==false||b?.daily_checkin_required!==false)throw new Error(`BAIDU_POLICY_ACCEPTANCE_FAILED:${JSON.stringify({payment_mode:b?.payment_mode,acoin_allowed:b?.acoin_allowed,paid_fallback:b?.paid_fallback,daily_maintenance_required:b?.daily_maintenance_required,daily_checkin_required:b?.daily_checkin_required})}`);
  console.log(JSON.stringify({ok:true,phase:"baidu-aistudio-health",configured:true,authenticated:true,manual_ready:true,payment_mode:"coupon",acoin_allowed:false,paid_fallback:false,daily_maintenance_required:false,daily_checkin_required:false,secret_echo:false}));
}finally{clearTimeout(timer)}