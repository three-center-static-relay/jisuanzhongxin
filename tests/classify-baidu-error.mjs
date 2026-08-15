import assert from "node:assert/strict";
const mode=String(process.argv[2]||"jobid");
const URL="https://compute-worker.a15280020511.workers.dev/__diag/baidu-circleci-live-20260815-a7c41e";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
let body={};
try{const r=await fetch(URL,{headers:{accept:"application/json"},signal:c.signal});const text=await r.text();try{body=text?JSON.parse(text):{}}catch{};assert.equal(r.status,200,`HTTP_${r.status}`)}finally{clearTimeout(timer)}
const t=body?.task||{},e=String(t.error||"");
assert.equal(t.status,"failed",`TASK_NOT_FAILED:${t.status||"none"}`);
const tests={
  jobid:/BAIDU_JOB_ID_NOT_FOUND/i,
  cli:/CLI_FAILED/i,
  missing:/MISSING_[A-Z0-9_]+/i,
  callback:/CALLBACK_HTTP|CALLBACK_/i,
  ticket:/TICKET|UNAUTHORIZED/i
};
assert.ok(tests[mode],"UNKNOWN_MODE");
console.log(JSON.stringify({mode,status:t.status,error_class:mode,error_present:Boolean(e)}));
assert.match(e,tests[mode],`ERROR_CLASS_MISMATCH:${e.slice(0,180)}`);
