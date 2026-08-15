import assert from "node:assert/strict";

const URL="https://compute-worker.a15280020511.workers.dev/__diag/baidu-circleci-live-20260815-a7c41e";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={raw:text.slice(0,500)}}return body}

const startResponse=await fetch(URL,{method:"POST",headers:{accept:"application/json"}});
const start=await read(startResponse);
console.log(JSON.stringify({phase:"start",http:startResponse.status,ok:start.ok===true,status:start.status||null,task_id:start.task_id||null,pipeline_id_present:Boolean(start.circleci_pipeline_id),error:start.error||null}));
assert.ok(startResponse.status===200||startResponse.status===202,`start HTTP ${startResponse.status}: ${JSON.stringify(start)}`);
assert.equal(start.ok,true,`start rejected: ${JSON.stringify(start)}`);

const deadline=Date.now()+10*60*1000;
let last=null;
while(Date.now()<deadline){
  await sleep(15000);
  const r=await fetch(URL,{headers:{accept:"application/json"}});
  const body=await read(r);last=body;
  const t=body?.task||{};
  console.log(JSON.stringify({phase:"poll",http:r.status,configured:body.configured===true,status:t.status||null,pipeline_id_present:Boolean(t.circleci_pipeline_id),baidu_job_id_present:t.baidu_job_id_present===true,verified:t.verification?.ok===true,result_digest_present:Boolean(t.result_digest),bridge_result_retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
  assert.equal(r.status,200,`status HTTP ${r.status}: ${JSON.stringify(body)}`);
  if(t.status==="completed"){
    assert.equal(t.verification?.ok,true,"Baidu V100 result verification failed");
    assert.match(String(t.result_digest||""),/^[a-f0-9]{64}$/i,"result digest missing");
    assert.equal(t.bridge_result_retrieved,true,"bridge result retrieval not confirmed");
    console.log(JSON.stringify({ok:true,suite:"live-baidu-circleci-e2e",task_id:t.task_id,status:t.status,v100_verified:true,result_retrieved:true,result_digest:t.result_digest}));
    process.exit(0);
  }
  if(t.status==="failed"||t.status==="cancelled")throw new Error(`BAIDU_E2E_${String(t.status).toUpperCase()}:${String(t.error||"")}`);
}
throw new Error(`BAIDU_E2E_TIMEOUT:${JSON.stringify(last)}`);
