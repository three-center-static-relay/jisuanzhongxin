import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-p24-terminal-detail-20260816-6b5f0e91d6374e8aa65a2c4b2e795b3c";
let threw=false;
try{
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
  try{const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});await r.text()}finally{clearTimeout(timer)}
}catch{threw=true}
assert.equal(threw,true);
console.log(JSON.stringify({ok:true,suite:"baidu-p24-build-fetch-exception",fetch_threw:true,http_response_observed:false}));
