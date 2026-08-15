import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__diag/baidu-circleci-live-20260815-c4f1a8";
const expected=String(process.argv[2]||"");
const r=await fetch(URL,{headers:{accept:"application/json"}});
const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={raw:text.slice(0,500)}}
const t=body?.task||null;
console.log(JSON.stringify({http:r.status,expected,configured:body.configured===true,task_present:Boolean(t),status:t?.status||null,pipeline_id_present:Boolean(t?.circleci_pipeline_id),baidu_job_id_present:t?.baidu_job_id_present===true,bridge_stage:t?.bridge_stage||null,failure_class:t?.failure_class||null,verification_ok:t?.verification?.ok===true,result_digest_present:Boolean(t?.result_digest),bridge_result_retrieved:t?.bridge_result_retrieved===true,error:t?.error||null}));
assert.equal(r.status,200,`probe HTTP ${r.status}: ${JSON.stringify(body)}`);
if(expected==="task")assert.ok(t,"task missing");
else if(expected==="failed")assert.equal(t?.status,"failed");
else if(expected==="completed")assert.equal(t?.status,"completed");
else if(expected==="jobid")assert.equal(t?.baidu_job_id_present,true);
else if(expected.startsWith("stage:"))assert.equal(t?.bridge_stage,expected.slice(6));
else if(expected.startsWith("class:"))assert.equal(t?.failure_class,expected.slice(6));
else throw new Error(`UNKNOWN_EXPECTATION:${expected}`);
console.log(JSON.stringify({ok:true,expected}));
