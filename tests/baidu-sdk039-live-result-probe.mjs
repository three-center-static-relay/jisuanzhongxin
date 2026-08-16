import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-b-20260816-02b50019f252cea7d92054e2cd44eff1";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.ok([200,202].includes(r.status));
  assert.equal(b.diagnostic,true);
  assert.equal(b.one_shot,true);
  assert.equal(b.sdk_version,"0.3.9");
  assert.equal(b.gpu,false);
  assert.equal(b.compute_credit_used,false);
  assert.ok(b.task&&typeof b.task==="object");
  assert.equal(b.task.task_id,"baidu-sdk039-control-plane-20260816b");
  assert.equal(b.task.sdk_candidate,"0.3.9");
  assert.equal(b.task.gpu,false);
  assert.equal(b.task.compute_credit_used,false);
  assert.equal(b.task.production_promoted,false);
  assert.ok(["bridge_dispatching","bridge_submitted","running","completed","failed","cancelled"].includes(String(b.task.status||"")));
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-isolated-status",status:String(b.task.status||""),workflow_status:b.task.circleci_workflow_status||null,sdk_selftest_passed:b.task.sdk_selftest_passed===true,gpu:false,compute_credit_used:false}));
}finally{clearTimeout(timer)}
