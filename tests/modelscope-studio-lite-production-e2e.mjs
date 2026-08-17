import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/selftest/modelscope-studio-lite-bootstrap-once";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),150000);
try{
  const r=await fetch(url,{
    method:"POST",
    headers:{
      accept:"application/json",
      "x-three-center-selftest":"studio-lite-once-v1-20260817"
    },
    signal:controller.signal
  });
  const body=await r.json().catch(()=>null);
  assert.equal(r.status,200,`ModelScope Studio Lite production E2E HTTP ${r.status}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok,true);
  assert.equal(body?.selftest,"modelscope-studio-lite-bootstrap-once");
  assert.equal(body?.stage,"runtime-verified","Acceptance must be a fresh runtime verification, not a cached prior receipt");
  assert.equal(body?.hardware?.name,"platform/2v-cpu-16g-mem");
  assert.equal(body?.hardware?.resource_type,"free");
  assert.equal(body?.runtime_receipt?.ok,true);
  assert.equal(body?.runtime_receipt?.revision,"studio-lite-runtime-v1-20260817");
  assert.ok(Number(body?.runtime_receipt?.cpu_effective)>=1.9,`effective CPU below threshold: ${body?.runtime_receipt?.cpu_effective}`);
  assert.ok(Number(body?.runtime_receipt?.memory_gib_effective)>=14,`effective memory below threshold: ${body?.runtime_receipt?.memory_gib_effective}`);
  assert.equal(Number(body?.runtime_receipt?.nominal_cpu),2);
  assert.equal(Number(body?.runtime_receipt?.nominal_memory_gb),16);
  assert.equal(body?.runtime_receipt?.square_sum_correct,true);
  assert.match(String(body?.runtime_receipt?.result_digest||""),/^[a-f0-9]{64}$/i);
  assert.ok(Number(body?.stop_http_status)>=200&&Number(body?.stop_http_status)<300,`Studio stop failed: HTTP ${body?.stop_http_status}`);
  assert.equal(body?.free_only,true);
  assert.equal(body?.paid_fallback,false);
  assert.equal(body?.secrets_redacted,true);
  console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-production-e2e",stage:body.stage,target_hardware:body.hardware.name,resource_type:body.hardware.resource_type,cpu_effective:body.runtime_receipt.cpu_effective,memory_gib_effective:body.runtime_receipt.memory_gib_effective,nominal_cpu:body.runtime_receipt.nominal_cpu,nominal_memory_gb:body.runtime_receipt.nominal_memory_gb,square_sum_correct:true,result_digest:body.runtime_receipt.result_digest,stop_http_status:body.stop_http_status,free_only:true,paid_fallback:false,secrets_redacted:true}));
}finally{clearTimeout(timer)}
