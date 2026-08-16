import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-b-20260816-02b50019f252cea7d92054e2cd44eff1";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,200);
  assert.equal(b.ok,true);
  assert.equal(b.diagnostic,true);
  assert.equal(b.one_shot,true);
  assert.equal(b.sdk_version,"0.3.9");
  assert.equal(b.gpu,false);
  assert.equal(b.compute_credit_used,false);
  assert.ok(b.task&&typeof b.task==="object");
  assert.equal(b.task.task_id,"baidu-sdk039-control-plane-20260816b");
  assert.equal(b.task.status,"completed");
  assert.equal(b.task.circleci_workflow_status,"success");
  assert.equal(b.task.sdk_selftest_passed,true);
  assert.equal(b.task.sdk_candidate,"0.3.9");
  assert.equal(b.task.gpu,false);
  assert.equal(b.task.compute_credit_used,false);
  assert.equal(b.task.production_promoted,false);
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-isolated-final",status:"completed",circleci_workflow_status:"success",sdk_selftest_passed:true,sdk_version:"0.3.9",gpu:false,compute_credit_used:false}));
}finally{clearTimeout(timer)}
