import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-terminal-detail-20260816-6b5f0e91d6374e8aa65a2c4b2e795b3c";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{}
  assert.equal(r.status,404);
  assert.notEqual(b.diagnostic,true);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24-production-route-not-active",http_status:404,diagnostic_route_active:false,network:true}));
}finally{clearTimeout(timer)}
