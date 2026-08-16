import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-terminal-detail-20260816-6b5f0e91d6374e8aa65a2c4b2e795b3c";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,200);
  assert.equal(b.status,"failed");
  assert.equal(b.failure_class,"BAIDU_JOB_TERMINAL_FAILED");
  assert.ok(b.upstream_diagnostic&&typeof b.upstream_diagnostic==="object"&&!Array.isArray(b.upstream_diagnostic));
  assert.ok(Object.keys(b.upstream_diagnostic).length>0);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24-upstream-diagnostic-present",upstream_diagnostic_present:true,network:true}));
}finally{clearTimeout(timer)}
