import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24b-20260816-8f1a0df2c7674ea6b33798bd56f2cd42";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  await r.text();
  assert.ok(r.status>=400&&r.status<500);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24b-live-status",state:"http-4xx",network:true}));
}finally{clearTimeout(timer)}
