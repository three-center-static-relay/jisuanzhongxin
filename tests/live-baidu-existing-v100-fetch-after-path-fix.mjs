import assert from "node:assert/strict";
const URL="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}

const startR=await fetch(URL,{method:"POST",headers:{accept:"application/json"}});
const start=await read(startR);
console.log(JSON.stringify({phase:"dispatch",http:startR.status,ok:start.ok===true,status:start.status||start.task?.status||null,already_completed:start.already_completed===true,pipeline_id_present:Boolean(start.circleci_pipeline_id),error:start.error||null}));
assert.ok([200,202].includes(startR.status),`dispatch HTTP ${startR.status}: ${JSON.stringify(start)}`);
assert.equal(start.ok,true,`dispatch rejected: ${JSON.stringify(start)}`);

const deadline=Date.now()+4*60*1000;let last=null;
while(Date.now()<deadline){
  await sleep(10000);
  const r=await fetch(URL,{headers:{accept:"application/json"}});const b=await read(r);last=b;const t=b?.task||{};
  console.log(JSON.stringify({phase:"poll",http:r.status,status:t.status||null,jobid:t.baidu_job_id_present===true,stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,result_digest_present:t.result_digest_present===true,retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
  assert.equal(r.status,200,`status HTTP ${r.status}: ${JSON.stringify(b)}`);
  if(t.status==="completed"){
    assert.equal(t.baidu_job_id_present,true,"Baidu pipeline id missing");
    assert.equal(t.bridge_stage,"result_retrieved","result_retrieved not reached");
    assert.equal(t.verification_ok,true,"Cloudflare V100 verification not passed");
    assert.equal(t.result_digest_present,true,"result digest missing");
    assert.equal(t.bridge_result_retrieved,true,"CircleCI result retrieval marker missing");
    console.log(JSON.stringify({ok:true,suite:"baidu-existing-v100-fetch-after-path-fix",status:"completed",verification_ok:true,result_retrieved:true}));
    process.exit(0);
  }
  if(t.status==="failed"||t.status==="cancelled")throw new Error(`FETCH_FAILED:stage=${t.bridge_stage||""}:class=${t.failure_class||""}:error=${t.error||""}`);
}
throw new Error(`FETCH_TIMEOUT:${JSON.stringify(last)}`);
