import assert from "node:assert/strict";
const BASE="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const CHECK=BASE+"/check";
const allowed=new Set([
  "BAIDU_QUERY_REQUEST_FAILED","BAIDU_QUERY_API_ERROR","BAIDU_JOB_ID_INVALID_OR_NOT_FOUND",
  "BAIDU_JOB_NOT_FINISHED","BAIDU_JOB_TERMINAL_FAILED","BAIDU_OUTPUT_ACCESS_REQUEST_FAILED",
  "BAIDU_OUTPUT_ACCESS_API_ERROR","BAIDU_OUTPUT_LIST_FAILED","BAIDU_RESULT_FILE_NOT_LISTED",
  "BAIDU_RESULT_LISTED_BUT_DOWNLOAD_FAILED"
]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}
const sr=await fetch(CHECK,{method:"POST",headers:{accept:"application/json"}});const s=await read(sr);
assert.ok([200,202].includes(sr.status),`CHECK dispatch HTTP ${sr.status}: ${JSON.stringify(s)}`);assert.equal(s.ok,true);
const deadline=Date.now()+120000;let last=null;
while(Date.now()<deadline){await sleep(5000);const r=await fetch(BASE,{headers:{accept:"application/json"}});const b=await read(r);last=b;const t=b?.task||{};console.log(JSON.stringify({status:t.status||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,retrieved:t.bridge_result_retrieved===true}));assert.equal(r.status,200);if(t.status==="completed"){assert.equal(t.verification_ok,true);assert.equal(t.result_digest_present,true);assert.equal(t.bridge_result_retrieved,true);process.exit(0)}if(t.status==="failed"){assert.equal(allowed.has(t.failure_class),true,`unexpected class=${t.failure_class}`);process.exit(0)}}
throw new Error(`CHECK_STAGE_LIST_TIMEOUT:${JSON.stringify(last)}`);
