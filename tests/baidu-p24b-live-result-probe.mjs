import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24b-result-20260816-ae9f40a8b99d43d9a28df1fcbf2ab7f4";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,200);
  assert.equal(b.diagnostic,true);
  assert.equal(b.one_shot,true);
  assert.ok(b.task&&typeof b.task==="object");
  assert.equal(b.task.task_id,"baidu-circleci-live-20260816p24b");
  assert.equal(b.ok,false);
  assert.equal(b.task.status,"failed");
  assert.equal(b.task.production_promoted,false);
  assert.equal(b.task.failure_class,"BAIDU_JOB_RUNTIME_PROCESS_TERMINAL_FAILED");
  console.log(JSON.stringify({ok:true,suite:"baidu-p24b-live-result-probe",failed:true,failure_class:"BAIDU_JOB_RUNTIME_PROCESS_TERMINAL_FAILED",sanitized:true}));
}finally{clearTimeout(timer)}
