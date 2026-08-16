import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-sdk039-control-result-20260816-d61c6d7be1ca4f43806ac1a021c1d8e8";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,404);
  assert.equal(b.diagnostic,true);
  assert.equal(b.error,"TASK_NOT_FOUND");
  assert.equal(b.task_id,"baidu-sdk039-control-plane-20260816a");
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-live-result-probe",task_not_found:true}));
}finally{clearTimeout(timer)}
