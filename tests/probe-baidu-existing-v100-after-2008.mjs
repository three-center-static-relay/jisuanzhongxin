import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
const t=b?.task||{};
console.log(JSON.stringify({http:r.status,status:t.status||null,jobid:t.baidu_job_id_present===true,stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,result_digest_present:t.result_digest_present===true,retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
assert.equal(r.status,200,"status endpoint failed");
assert.equal(t.baidu_job_id_present,true,"Baidu job id missing");
assert.equal(t.bridge_stage,"result_polling","task is not in result_polling");
assert.notEqual(t.status,"completed","unexpected completed state");
assert.notEqual(t.verification_ok,true,"unexpected verification success");
assert.notEqual(t.result_digest_present,true,"unexpected result digest");
assert.notEqual(t.bridge_result_retrieved,true,"unexpected retrieval marker");
console.log(JSON.stringify({ok:true,suite:"baidu-existing-v100-after-2008",conclusion:"result_still_unavailable_to_circleci"}));
