import assert from "node:assert/strict";
const mode=String(process.argv[2]||"pipeline");
const URL="https://compute-worker.a15280020511.workers.dev/__diag/baidu-circleci-live-20260815-a7c41e";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
let body={};
try{const r=await fetch(URL,{headers:{accept:"application/json"},signal:c.signal});const text=await r.text();try{body=text?JSON.parse(text):{}}catch{};assert.equal(r.status,200,`HTTP_${r.status}`)}finally{clearTimeout(timer)}
const t=body?.task||{};
console.log(JSON.stringify({mode,configured:body.configured===true,status:t.status||null,pipeline_id_present:Boolean(t.circleci_pipeline_id),baidu_job_id_present:t.baidu_job_id_present===true,verified:t.verification?.ok===true,result_digest_present:Boolean(t.result_digest),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
if(mode==="pipeline")assert.ok(t.circleci_pipeline_id,"CIRCLECI_PIPELINE_NOT_CREATED");
else if(mode==="baidu")assert.equal(t.baidu_job_id_present,true,`BAIDU_JOB_ID_NOT_PRESENT status=${t.status||"none"} error=${t.error||""}`);
else if(mode==="completed")assert.ok(t.status==="completed"&&t.verification?.ok===true&&t.bridge_result_retrieved===true&&/^[a-f0-9]{64}$/i.test(String(t.result_digest||"")),`NOT_VERIFIED_COMPLETED status=${t.status||"none"} error=${t.error||""}`);
else if(mode==="failed")assert.equal(t.status,"failed",`NOT_FAILED status=${t.status||"none"}`);
else if(mode==="terminal")assert.ok(["completed","failed","cancelled"].includes(String(t.status||"")),`NOT_TERMINAL status=${t.status||"none"}`);
else throw new Error("UNKNOWN_PROBE_MODE");
