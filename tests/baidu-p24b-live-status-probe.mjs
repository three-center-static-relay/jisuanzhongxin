import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24b-20260816-8f1a0df2c7674ea6b33798bd56f2cd42";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},redirect:"manual",signal:c.signal});
  await r.text();
  assert.ok(r.status>=300&&r.status<400);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24b-live-status",state:"http-redirect-before-follow",location_present:Boolean(r.headers.get('location')),network:true}));
}finally{clearTimeout(timer)}
