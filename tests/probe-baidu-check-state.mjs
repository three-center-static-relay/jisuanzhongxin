import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,failure_class:t.failure_class||null,stage:t.bridge_stage||null}));
assert.equal(r.status,200);
assert.equal(t.status,"failed");
const group=new Set(["BAIDU_JOB_NOT_FINISHED","BAIDU_RESULT_FILE_NOT_FOUND","BAIDU_JOB_ID_INVALID_OR_NOT_FOUND"]);
assert.equal(group.has(String(t.failure_class||"")),true,`failure class is outside availability/id group: ${t.failure_class}`);
console.log(JSON.stringify({ok:true,suite:"probe-baidu-check-class-group",group:"availability_or_id"}));
