import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-result-20260816-8c1f416e63304bf98619ca9fd9f3cb58";
const r=await fetch(url,{headers:{accept:"application/json"}});const b=await r.json();
assert.equal(b.diagnostic,true);
assert.equal(b.task_id,"baidu-circleci-live-20260816p24a");
assert.equal(b.status,"failed");
assert.match(String(b.failure_class||""),/^[A-Z0-9_]{3,80}$/);
assert.equal(b.production_ready,false);
console.log(JSON.stringify({ok:true,suite:"baidu-p24-classify-failed",failure_class:b.failure_class}));
