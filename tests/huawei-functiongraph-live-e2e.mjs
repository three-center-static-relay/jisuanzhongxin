import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/v1/providers/huawei-functiongraph/meta";
const response=await fetch(url,{headers:{"accept":"application/json","cache-control":"no-cache"},signal:AbortSignal.timeout(30000)});
const text=await response.text();
assert.equal(response.status,200,"meta route HTTP must be 200");
let body;
try{body=JSON.parse(text)}catch{throw new Error(`meta route returned non-JSON: ${text.slice(0,200)}`)}
assert.equal(body.ok,true,"meta route must return ok=true");
console.log(JSON.stringify({ok:true,acceptance:"COMPUTE_WORKER_HUAWEI_ROUTE_REACHABLE",http_status:response.status,json:true,secrets_redacted:true}));