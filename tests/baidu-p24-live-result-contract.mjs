import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-result-20260816-8c1f416e63304bf98619ca9fd9f3cb58";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.diagnostic,true);
  assert.equal(body.task_id,"baidu-circleci-live-20260816p24a");
  assert.equal(body.status,"completed");
  assert.equal(body.runtime_candidate,"paddle2.4_py3.7");
  assert.equal(body.failure_class,null);
  assert.equal(body.result_digest_present,true);
  assert.match(String(body.result_digest||""),/^[a-f0-9]{64}$/i);
  assert.equal(body.bridge_result_retrieved,true);
  assert.equal(body.verification?.v100_visible,true);
  assert.equal(body.verification?.paddle_cuda,true);
  assert.match(String(body.verification?.gpu_name||""),/v100/i);
  assert.match(String(body.verification?.device||""),/gpu/i);
  assert.equal(body.production_ready,true);
  assert.equal(body.secrets_redacted,true);
  assert.equal(body.result_body_exposed,false);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24-live-result-contract",task_id:body.task_id,status:body.status,runtime:body.runtime_candidate,result_digest_present:true,bridge_result_retrieved:true,v100_visible:true,paddle_cuda:true,production_ready:true,network:true}));
}finally{clearTimeout(timer)}
