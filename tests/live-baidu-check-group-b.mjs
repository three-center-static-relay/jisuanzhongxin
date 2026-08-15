import assert from "node:assert/strict";
// read-only binary search of persisted terminal failure class; no CircleCI/Baidu dispatch
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const ALLOWED=new Set(["MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN","MISSING_COMPUTE_CALLBACK_URL","MISSING_BRIDGE_TICKET","CALLBACK_HTTP","BAIDU_BRIDGE_FAILED"]);
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,result_digest_present:t.result_digest_present===true,retrieved:t.bridge_result_retrieved===true}));
assert.equal(r.status,200,`status HTTP ${r.status}: ${JSON.stringify(b)}`);
if(t.status==="completed"){
  assert.equal(t.verification_ok,true);assert.equal(t.result_digest_present,true);assert.equal(t.bridge_result_retrieved,true);
}else{
  assert.equal(t.status,"failed",`unexpected status=${t.status}`);
  assert.equal(ALLOWED.has(t.failure_class),true,`persisted diagnostic class=${t.failure_class}`);
}
console.log(JSON.stringify({ok:true,suite:"baidu-persisted-failure-group-b"}));
