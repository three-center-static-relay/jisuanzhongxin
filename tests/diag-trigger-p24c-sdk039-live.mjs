import assert from "node:assert/strict";

// Diagnostic-only one-shot trigger; fixed production task id prevents duplicate Baidu jobs.
const url="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-v100-p24c-sdk039-20260817-0384d41bd74495a633af72ee3a0ba1b03b064a83776dea891af8d741368151fa";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,202);
  assert.equal(body.ok,true);
  assert.equal(body.task_id,"baidu-circleci-live-20260817p24c-sdk039");
  assert.equal(body.status,"bridge_submitted");
  assert.equal(body.runtime,"paddle2.4_py3.7");
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.device,"v100");
  assert.equal(body.gpus,1);
  assert.equal(body.payment,"coupon");
  assert.equal(body.one_shot,true);
  assert.equal(body.automatic_retry,false);
  assert.equal(body.production_promoted,false);
  console.log(JSON.stringify({ok:true,suite:"diag-trigger-p24c-sdk039-live",http_status:r.status,task_id:body.task_id,status:body.status,runtime:body.runtime,sdk_version:body.sdk_version,device:body.device,gpus:body.gpus,payment:body.payment,one_shot:body.one_shot,automatic_retry:body.automatic_retry,production_promoted:body.production_promoted}));
} finally {
  clearTimeout(timer);
}
