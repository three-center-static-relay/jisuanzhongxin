import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-20260816-d61c6d7be1ca4f43806ac1a021c1d8e8";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,200);
  assert.equal(b.diagnostic,true);
  assert.equal(b.one_shot,true);
  assert.equal(b.sdk_version,"0.3.9");
  assert.equal(b.gpu,false);
  assert.equal(b.compute_credit_used,false);
  assert.ok(b.task&&typeof b.task==="object");
  assert.equal(b.task.task_id,"baidu-sdk039-control-plane-20260816a");
  assert.equal(b.task.status,"failed");
  assert.equal(b.task.sdk_candidate,"0.3.9");
  assert.equal(b.task.gpu,false);
  assert.equal(b.task.compute_credit_used,false);
  assert.equal(b.task.production_promoted,false);
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-terminal-classifier",status:"failed",gpu:false,compute_credit_used:false}));
}finally{clearTimeout(timer)}
