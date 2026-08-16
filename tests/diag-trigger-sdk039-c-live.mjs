import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__selftest/baidu-sdk039-direct-c-20260816-ade741fd3291c5e71c32c7b66fd055d80a3a56062bd954c47ca7e2c33e05062e";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,202);
  assert.equal(body.ok,true);
  assert.equal(body.task_id,"baidu-sdk039-control-plane-20260816c");
  assert.equal(body.status,"bridge_submitted");
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.gpu,false);
  assert.equal(body.compute_credit_used,false);
  assert.equal(body.one_shot,true);
  console.log(JSON.stringify({ok:true,suite:"diag-trigger-sdk039-c-live",http_status:r.status,task_id:body.task_id,status:body.status,sdk_version:body.sdk_version,gpu:body.gpu,compute_credit_used:body.compute_credit_used,one_shot:body.one_shot}));
} finally {
  clearTimeout(timer);
}
