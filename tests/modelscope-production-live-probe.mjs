import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/selftest/modelscope-runtime";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),25000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json().catch(()=>null);
  assert.equal(r.status,200,`ModelScope compute production selftest HTTP ${r.status}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok,true);
  assert.equal(body?.secret_present,true);
  assert.equal(body?.authenticated,true);
  assert.equal(body?.hardware_discovery_ok,true);
  assert.equal(body?.free_only,true);
  assert.equal(body?.paid_fallback,false);
  console.log(JSON.stringify({ok:true,suite:"modelscope-production-live-probe",center:"compute",authenticated:true,hardware_discovery_ok:true,free_hardware_verified:body?.free_hardware_verified===true,free_cpu_verified:body?.free_cpu_verified===true,acceptance_state:body?.acceptance_state||null,secrets_redacted:true}));
}finally{clearTimeout(timer)}
