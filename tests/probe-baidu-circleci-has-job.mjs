import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d/circleci";
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let b={};try{b=text?JSON.parse(text):{}}catch{b={raw:text.slice(0,500)}}
console.log(JSON.stringify({http:r.status,ok:b.ok===true,classification:b.classification||null,has_workflow:b.has_workflow===true,has_job:b.has_job===true,workflow_status:b.workflow_status||null,job_statuses:b.job_statuses||null,task_status:b.task_status||null,error:b.error||null,circle_http:b.circle_http||null}));
assert.equal(r.status,200,`circle status HTTP ${r.status}: ${JSON.stringify(b)}`);
assert.equal(b.ok,true,`circle state error: ${JSON.stringify(b)}`);
assert.equal(b.has_workflow,true,`classification=${b.classification}`);
assert.equal(b.has_job,true,`classification=${b.classification}`);
