import assert from "node:assert/strict";
// trigger 2026-08-15T20:55+08:00
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,stage:t.bridge_stage||null,failure_class:t.failure_class||null,jobid:t.baidu_job_id_present===true,verification_ok:t.verification_ok===true,retrieved:t.bridge_result_retrieved===true}));
assert.equal(r.status,200,`status HTTP ${r.status}`);
assert.equal(new Set(["running","bridge_checking"]).has(t.status),true,`persisted status=${t.status}`);
assert.notEqual(t.verification_ok,true,"unexpected verification success");
assert.notEqual(t.bridge_result_retrieved,true,"unexpected result retrieval");
console.log(JSON.stringify({ok:true,suite:"baidu-persisted-running-state"}));
