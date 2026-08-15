import assert from "node:assert/strict";

const BASE="https://compute-worker.a15280020511.workers.dev";
const FETCH=`${BASE}/__diag/baidu-circleci-live-20260815-d7a21f/fetch`;
const STATUS=`${BASE}/__diag/baidu-circleci-live-20260815-d7a21f`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function body(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}

const startR=await fetch(FETCH,{method:"POST",headers:{accept:"application/json"}});
const start=await body(startR);
console.log(JSON.stringify({phase:"fetch_dispatch",http:startR.status,ok:start.ok===true,status:start.status||null,pipeline_id_present:Boolean(start.circleci_pipeline_id),error:start.error||null}));
assert.ok([200,202].includes(startR.status),`FETCH dispatch HTTP ${startR.status}: ${JSON.stringify(start)}`);
assert.equal(start.ok,true,`FETCH dispatch rejected: ${JSON.stringify(start)}`);

const deadline=Date.now()+3*60*1000;
let last=null;
while(Date.now()<deadline){
  await sleep(10000);
  const r=await fetch(STATUS,{headers:{accept:"application/json"}});
  const b=await body(r);last=b;
  const t=b?.task||{};
  console.log(JSON.stringify({phase:"poll",http:r.status,status:t.status||null,baidu_job_id_present:t.baidu_job_id_present===true,bridge_stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification?.ok===true,result_digest_present:Boolean(t.result_digest),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
  assert.equal(r.status,200,`status HTTP ${r.status}: ${JSON.stringify(b)}`);
  if(t.status==="completed"){
    assert.equal(t.baidu_job_id_present,true,"Baidu job ID missing");
    assert.equal(t.bridge_stage,"result_retrieved","result_retrieved not reached");
    assert.equal(t.verification?.ok,true,"Cloudflare V100 verification failed");
    assert.match(String(t.result_digest||""),/^[a-f0-9]{64}$/i,"result digest missing");
    assert.equal(t.bridge_result_retrieved,true,"CircleCI result retrieval not confirmed");
    console.log(JSON.stringify({ok:true,suite:"existing-baidu-v100-fetch-e2e",task_id:t.task_id,status:t.status,v100_verified:true,result_retrieved:true,result_digest:t.result_digest}));
    process.exit(0);
  }
  if(t.status==="failed"||t.status==="cancelled")throw new Error(`FETCH_E2E_${String(t.status).toUpperCase()}:stage=${String(t.bridge_stage||"")}:class=${String(t.failure_class||"")}:error=${String(t.error||"")}`);
}
throw new Error(`FETCH_E2E_TIMEOUT:${JSON.stringify(last)}`);
