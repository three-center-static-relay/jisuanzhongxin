import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-result-20260816-8c1f416e63304bf98619ca9fd9f3cb58";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const body=await r.json();
  assert.equal(body.diagnostic,true);
  assert.equal(body.secrets_redacted,true);
  if(body.task_id!==undefined)assert.equal(body.task_id,"baidu-circleci-live-20260816p24a");
  assert.equal(JSON.stringify(body).includes("bridge_ticket"),false);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24-route-smoke",http_status:r.status,diagnostic:true,task_visible:body.task_id==="baidu-circleci-live-20260816p24a",error:body.error||null,network:true}));
}finally{clearTimeout(timer)}
