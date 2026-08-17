import assert from "node:assert/strict";

// Status-only diagnostic. This file must never call the P24c acceptance trigger again.
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24c-sdk039-result-20260817-16949c117c8ccea6136c971cd31e4333b603dd89372c1ceefd0be852a96a03f0";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.ok([200,202].includes(r.status));
  assert.equal(body.diagnostic,true);
  assert.equal(body.runtime,"paddle2.4_py3.7");
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.one_shot,true);
  assert.equal(body.task?.task_id,"baidu-circleci-live-20260817p24c-sdk039");
  assert.equal(body.task?.runtime_candidate,"paddle2.4_py3.7");
  assert.equal(body.task?.sdk_candidate,"0.3.9");
  assert.equal(body.task?.device,"v100");
  assert.equal(body.task?.gpus,1);
  assert.equal(body.task?.payment,"coupon");
  assert.equal(body.task?.one_shot,true);
  assert.equal(body.task?.automatic_retry,false);
  assert.equal(body.task?.production_promoted,false);
  assert.ok(["bridge_dispatching","bridge_submitted","running","completed","failed","cancelled"].includes(body.task?.status));
  console.log(JSON.stringify({ok:true,suite:"diag-read-p24c-sdk039-live",http_status:r.status,task_id:body.task.task_id,status:body.task.status,runtime:body.task.runtime_candidate,sdk_version:body.task.sdk_candidate,device:body.task.device,gpus:body.task.gpus,payment:body.task.payment,bridge_stage:body.task.bridge_stage,failure_class:body.task.failure_class,result_digest_present:Boolean(body.task.result_digest),bridge_result_retrieved:body.task.bridge_result_retrieved===true,verification:body.task.verification||null,production_promoted:body.task.production_promoted}));
} finally {
  clearTimeout(timer);
}
