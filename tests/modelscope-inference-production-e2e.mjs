import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/selftest/modelscope-inference";
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),45000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:controller.signal});
  const body=await r.json().catch(()=>null);
  assert.equal(r.status,200,`ModelScope inference production E2E HTTP ${r.status}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok,true);
  assert.equal(body?.secret_present,true);
  assert.equal(body?.authenticated,true);
  assert.equal(body?.inference_ok,true);
  assert.equal(body?.correct,true);
  assert.equal(body?.expected,"323");
  assert.equal(body?.free_only,true);
  assert.equal(body?.paid_fallback,false);
  assert.equal(body?.secrets_redacted,true);
  console.log(JSON.stringify({ok:true,suite:"modelscope-inference-production-e2e",authenticated:true,inference_ok:true,correct:true,expected:"323",model:body?.model||null,content_digest:body?.content_digest||null,free_only:true,paid_fallback:false,secrets_redacted:true}));
}finally{clearTimeout(timer)}
