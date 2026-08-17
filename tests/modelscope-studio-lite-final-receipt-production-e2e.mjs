import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/selftest/modelscope-studio-lite";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json().catch(()=>null);
  assert.equal(r.status,200,`Studio Lite receipt HTTP ${r.status}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok,true);
  assert.equal(body?.selftest,"modelscope-studio-lite");
  assert.equal(body?.runtime_e2e_verified,true);
  assert.equal(body?.route_eligible,true);
  assert.equal(body?.target_hardware,"platform/2v-cpu-16g-mem");
  assert.equal(body?.hardware?.name,"platform/2v-cpu-16g-mem");
  assert.equal(body?.hardware?.resource_type,"free");
  assert.equal(body?.runtime_receipt?.ok,true);
  assert.equal(body?.runtime_receipt?.revision,"studio-lite-runtime-v2-20260817");
  assert.ok(Number(body?.runtime_receipt?.cpu_effective)>=1.9,`effective CPU below threshold: ${body?.runtime_receipt?.cpu_effective}`);
  assert.ok(Number(body?.runtime_receipt?.memory_gib_effective)>=14,`effective memory below threshold: ${body?.runtime_receipt?.memory_gib_effective}`);
  assert.equal(Number(body?.runtime_receipt?.nominal_cpu),2);
  assert.equal(Number(body?.runtime_receipt?.nominal_memory_gb),16);
  assert.equal(body?.runtime_receipt?.square_sum_correct,true);
  assert.match(String(body?.runtime_receipt?.result_digest||""),/^[a-f0-9]{64}$/i);
  assert.equal(body?.free_only,true);
  assert.equal(body?.paid_fallback,false);
  assert.equal(body?.secrets_redacted,true);
  console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-final-receipt-production-e2e",read_only:true,target_hardware:body.hardware.name,resource_type:body.hardware.resource_type,cpu_effective:body.runtime_receipt.cpu_effective,memory_gib_effective:body.runtime_receipt.memory_gib_effective,nominal_cpu:body.runtime_receipt.nominal_cpu,nominal_memory_gb:body.runtime_receipt.nominal_memory_gb,square_sum_correct:true,result_digest:body.runtime_receipt.result_digest,revision:body.runtime_receipt.revision,free_only:true,paid_fallback:false,secrets_redacted:true}));
}finally{clearTimeout(timer)}
