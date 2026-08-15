import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d/circleci/steps";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
console.log(JSON.stringify({http:r.status,ok:b.ok===true,classification:b.classification||null,failed_step_class:b.failed_step_class||null,failed_step_name:b.failed_step_name||null,job_status:b.job_status||null,error:b.error||null,circle_http:b.circle_http||null,project_slug_family:b.project_slug_family||null}));
assert.equal(r.status,200,`steps HTTP ${r.status}: ${JSON.stringify(b)}`);
assert.equal(b.ok,true,`steps diagnostic error: ${JSON.stringify(b)}`);
assert.equal(b.classification,"BRIDGE_STEP_FAILED",`classification=${b.classification}, failed=${b.failed_step_name}`);
