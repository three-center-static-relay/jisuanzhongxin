import assert from "node:assert/strict";

// Status-only nonterminal classifier. Never calls the P24c acceptance trigger.
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24c-sdk039-result-20260817-16949c117c8ccea6136c971cd31e4333b603dd89372c1ceefd0be852a96a03f0";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,202);
  assert.equal(body.ok,false);
  assert.equal(body.diagnostic,true);
  assert.equal(body.runtime,"paddle2.4_py3.7");
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.one_shot,true);
  assert.equal(body.task?.task_id,"baidu-circleci-live-20260817p24c-sdk039");
  assert.ok(["bridge_dispatching","bridge_submitted","running"].includes(body.task?.status));
  assert.equal(body.task?.runtime_candidate,"paddle2.4_py3.7");
  assert.equal(body.task?.sdk_candidate,"0.3.9");
  assert.equal(body.task?.device,"v100");
  assert.equal(body.task?.gpus,1);
  assert.equal(body.task?.payment,"coupon");
  assert.equal(body.task?.one_shot,true);
  assert.equal(body.task?.automatic_retry,false);
  assert.equal(body.task?.production_promoted,false);
  assert.equal(body.task?.failure_class,null);
  assert.equal(body.task?.result_digest,null);
  assert.equal(body.task?.bridge_result_retrieved,false);
  console.log(JSON.stringify({ok:true,suite:"diag-p24c-sdk039-nonterminal",task_id:body.task.task_id,status:body.task.status,bridge_stage:body.task.bridge_stage,runtime:body.task.runtime_candidate,sdk_version:body.task.sdk_candidate,device:body.task.device,gpus:body.task.gpus,payment:body.task.payment,production_promoted:body.task.production_promoted}));
} finally {
  clearTimeout(timer);
}
