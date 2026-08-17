import assert from "node:assert/strict";

// Status-only strict success classifier. Never calls the acceptance trigger.
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24c-sdk039-result-20260817-16949c117c8ccea6136c971cd31e4333b603dd89372c1ceefd0be852a96a03f0";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),30000);
try{
  const r=await fetch(url,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.diagnostic,true);
  assert.equal(body.runtime,"paddle2.4_py3.7");
  assert.equal(body.sdk_version,"0.3.9");
  assert.equal(body.one_shot,true);
  assert.equal(body.task?.task_id,"baidu-circleci-live-20260817p24c-sdk039");
  assert.equal(body.task?.status,"completed");
  assert.equal(body.task?.runtime_candidate,"paddle2.4_py3.7");
  assert.equal(body.task?.sdk_candidate,"0.3.9");
  assert.equal(body.task?.device,"v100");
  assert.equal(body.task?.gpus,1);
  assert.equal(body.task?.payment,"coupon");
  assert.equal(body.task?.one_shot,true);
  assert.equal(body.task?.automatic_retry,false);
  assert.equal(body.task?.production_promoted,false);
  assert.match(String(body.task?.result_digest||""),/^[a-f0-9]{64}$/i);
  assert.equal(body.task?.bridge_result_retrieved,true);
  assert.equal(body.task?.verification?.v100_visible,true);
  assert.equal(body.task?.verification?.paddle_cuda,true);
  assert.match(String(body.task?.verification?.gpu_name||""),/v100/i);
  assert.match(String(body.task?.verification?.device||""),/gpu/i);
  assert.equal(body.task?.failure_class,null);
  console.log(JSON.stringify({ok:true,suite:"diag-p24c-sdk039-strict-success",task_id:body.task.task_id,status:body.task.status,runtime:body.task.runtime_candidate,sdk_version:body.task.sdk_candidate,result_digest:body.task.result_digest,bridge_result_retrieved:body.task.bridge_result_retrieved,verification:body.task.verification,production_promoted:body.task.production_promoted}));
} finally {
  clearTimeout(timer);
}
