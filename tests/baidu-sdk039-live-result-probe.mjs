import assert from "node:assert/strict";

// second read after the production cron had another scheduling cycle
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-20260816-d61c6d7be1ca4f43806ac1a021c1d8e8";
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
  assert.equal(b.task.task_id,"baidu-sdk039-control-plane-20260816a");
  assert.equal(b.task.gpu,false);
  assert.equal(b.task.compute_credit_used,false);
  assert.equal(b.task.production_promoted,false);
  assert.ok(["bridge_dispatching","bridge_submitted","running","completed","failed","cancelled"].includes(String(b.task.status||"")));
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-live-result-probe",task_present:true,status:String(b.task.status||""),gpu:false,compute_credit_used:false,sanitized:true}));
}finally{clearTimeout(timer)}
