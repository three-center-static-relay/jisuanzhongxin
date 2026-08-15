import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,failure_class:t.failure_class||null,stage:t.bridge_stage||null,verification_ok:t.verification_ok===true,retrieved:t.bridge_result_retrieved===true}));
assert.equal(r.status,200);
assert.equal(t.status,"failed","task is not failed after CHECK diagnostic");
assert.match(String(t.failure_class||""),/^BAIDU_[A-Z0-9_]+$/);
console.log(JSON.stringify({ok:true,suite:"probe-baidu-check-state",status:"failed"}));
