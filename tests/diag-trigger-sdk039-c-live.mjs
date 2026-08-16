import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-c-20260816-01285625c159573990bb9a1fed3d6dd84e6be7b8994f5b3ed51f5497b04fd476";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.diagnostic,true);
  assert.equal(body.one_shot,true);
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.gpu,false);
  assert.equal(body.compute_credit_used,false);
  assert.equal(body.ok,true);
  assert.equal(body.task?.task_id,"baidu-sdk039-control-plane-20260816c");
  assert.equal(body.task?.status,"completed");
  assert.equal(body.task?.sdk_candidate,"0.3.9");
  assert.equal(body.task?.sdk_selftest_passed,true);
  assert.equal(body.task?.terminal_callback_received,true);
  assert.equal(body.task?.failure_class,null);
  assert.equal(body.task?.production_promoted,false);
  assert.equal(body.task?.gpu,false);
  assert.equal(body.task?.compute_credit_used,false);
  console.log(JSON.stringify({ok:true,suite:"diag-read-sdk039-c-live",http_status:r.status,task_id:body.task.task_id,status:body.task.status,sdk_version:body.sdk_version,sdk_selftest_passed:body.task.sdk_selftest_passed,terminal_callback_received:body.task.terminal_callback_received,gpu:body.task.gpu,compute_credit_used:body.task.compute_credit_used,production_promoted:body.task.production_promoted}));
} finally {
  clearTimeout(timer);
}
