import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__diag/baidu-circleci-live-20260815-d7a21f";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,baidu_job_id_present:t.baidu_job_id_present===true,bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification?.ok===true,result_digest_present:Boolean(t.result_digest),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
assert.equal(r.status,200);
assert.equal(t.baidu_job_id_present,true,"existing Baidu job ID missing");
assert.equal(t.bridge_stage,"result_polling","not at result_polling");
assert.notEqual(t.status,"completed","unexpected completed state without strict runner success");
assert.notEqual(t.verification?.ok,true,"unexpected verified state without completion");
assert.equal(Boolean(t.result_digest),false,"unexpected result digest");
assert.notEqual(t.bridge_result_retrieved,true,"unexpected retrieved marker");
console.log(JSON.stringify({ok:true,suite:"baidu-existing-fetch-state",conclusion:"result_not_available_to_circleci"}));
