import assert from "node:assert/strict";
// trigger 2026-08-15T20:22+08:00
const BASE="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const CHECK=BASE+"/check";
const EXPECTED="BAIDU_JOB_ID_INVALID_OR_NOT_FOUND";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}

const sr=await fetch(CHECK,{method:"POST",headers:{accept:"application/json"}});const s=await read(sr);
console.log(JSON.stringify({phase:"dispatch",http:sr.status,ok:s.ok===true,status:s.status||s.task?.status||null,error:s.error||null}));
assert.ok([200,202].includes(sr.status),`CHECK dispatch HTTP ${sr.status}: ${JSON.stringify(s)}`);
assert.equal(s.ok,true,`CHECK rejected: ${JSON.stringify(s)}`);

const deadline=Date.now()+150000;let last=null;
while(Date.now()<deadline){
  await sleep(10000);
  const r=await fetch(CHECK,{headers:{accept:"application/json"}});const b=await read(r);last=b;const t=b?.task||{};
  console.log(JSON.stringify({phase:"poll",http:r.status,status:t.status||null,jobid:t.baidu_job_id_present===true,stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,result_digest_present:t.result_digest_present===true,retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
  assert.equal(r.status,200);
  if(t.status==="completed"){
    assert.equal(t.verification_ok,true);
    assert.equal(t.result_digest_present,true);
    assert.equal(t.bridge_result_retrieved,true);
    console.log(JSON.stringify({ok:true,conclusion:"RESULT_COMPLETED_DURING_CHECK"}));
    process.exit(0);
  }
  if(t.status==="failed"){
    assert.equal(t.failure_class,EXPECTED,`diagnostic class=${t.failure_class}`);
    console.log(JSON.stringify({ok:true,conclusion:EXPECTED}));
    process.exit(0);
  }
}
throw new Error(`CHECK_DIAGNOSTIC_TIMEOUT:${JSON.stringify(last)}`);
