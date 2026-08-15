import assert from "node:assert/strict";
// trigger 2026-08-15T20:46+08:00
const BASE="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const CHECK=BASE+"/check";
const ALLOWED=new Set(["BAIDU_JOB_EXPIRED","AISTUDIO_AUTH_CLI_FAILED","AISTUDIO_AUTH_CLI_NOT_FOUND","AISTUDIO_AUTH_CLI_TIMEOUT"]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}
const sr=await fetch(CHECK,{method:"POST",headers:{accept:"application/json"}});const s=await read(sr);assert.ok([200,202].includes(sr.status),`CHECK dispatch HTTP ${sr.status}: ${JSON.stringify(s)}`);assert.equal(s.ok,true);
const deadline=Date.now()+150000;let last=null;while(Date.now()<deadline){await sleep(10000);const r=await fetch(CHECK,{headers:{accept:"application/json"}});const b=await read(r);last=b;const t=b?.task||{};console.log(JSON.stringify({status:t.status||null,failure_class:t.failure_class||null}));assert.equal(r.status,200);if(t.status==="completed"){assert.equal(t.verification_ok,true);assert.equal(t.result_digest_present,true);assert.equal(t.bridge_result_retrieved,true);process.exit(0)}if(t.status==="failed"){assert.equal(ALLOWED.has(t.failure_class),true,`diagnostic class=${t.failure_class}`);process.exit(0)}}throw new Error(`CHECK_DIAGNOSTIC_TIMEOUT:${JSON.stringify(last)}`);
