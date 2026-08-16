import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24b-20260816-8f1a0df2c7674ea6b33798bd56f2cd42";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,404);
  assert.equal(b.diagnostic,true);
  assert.equal(b.error,"TASK_NOT_FOUND");
  assert.equal(b.task_id,"baidu-circleci-live-20260816p24b");
  console.log(JSON.stringify({ok:true,suite:"baidu-p24b-live-status",state:"route-active-task-not-found",network:true}));
}finally{clearTimeout(timer)}
