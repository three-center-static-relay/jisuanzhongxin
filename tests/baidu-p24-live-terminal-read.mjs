import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-terminal-detail-20260816-6b5f0e91d6374e8aa65a2c4b2e795b3c";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,200);
  assert.equal(b.diagnostic,true);
  assert.equal(b.read_only,true);
  assert.equal(b.operation,"CHECK");
  assert.equal(b.gpu_submit,false);
  assert.equal(b.status,"failed");
  assert.match(String(b.failure_class||""),/^(BAIDU|DIAGNOSTIC)_[A-Z0-9_]{3,80}$/);
  assert.equal(b.secrets_redacted,true);
  assert.equal(b.source_job_id_exposed,false);
  assert.equal(b.result_body_exposed,false);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24-live-terminal-read",status:"failed",failure_class_present:true,upstream_diagnostic_present:Boolean(b.upstream_diagnostic),network:true}));
}finally{clearTimeout(timer)}
