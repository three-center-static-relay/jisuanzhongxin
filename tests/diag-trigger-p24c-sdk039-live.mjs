import assert from "node:assert/strict";

// Status-only failure-stage classifier. Never calls the P24c acceptance trigger.
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24c-sdk039-result-20260817-16949c117c8ccea6136c971cd31e4333b603dd89372c1ceefd0be852a96a03f0";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try {
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.ok,false);
  assert.equal(body.task?.task_id,"baidu-circleci-live-20260817p24c-sdk039");
  assert.equal(body.task?.status,"failed");
  assert.equal(body.task?.runtime_candidate,"paddle2.4_py3.7");
  assert.equal(body.task?.sdk_candidate,"0.3.9");
  assert.ok(["result_polling","result_retrieved"].includes(body.task?.bridge_stage));
  assert.equal(body.task?.result_digest,null);
  assert.equal(body.task?.bridge_result_retrieved,false);
  assert.equal(body.task?.production_promoted,false);
  console.log(JSON.stringify({ok:true,suite:"diag-p24c-sdk039-result-stage-group",failure_class:body.task.failure_class,bridge_stage:body.task.bridge_stage,upstream_diagnostic:body.task.upstream_diagnostic||null}));
} finally { clearTimeout(timer); }
