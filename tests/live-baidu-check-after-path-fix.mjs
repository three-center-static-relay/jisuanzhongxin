import assert from "node:assert/strict";
const BASE="https://compute-worker.a15280020511.workers.dev/__acceptance/baidu-existing-v100-20260815d";
const CHECK=BASE+"/check";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{return{raw:text.slice(0,500)}}}

const sr=await fetch(CHECK,{method:"POST",headers:{accept:"application/json"}});
const s=await read(sr);
console.log(JSON.stringify({phase:"check_dispatch",http:sr.status,ok:s.ok===true,status:s.status||s.task?.status||null,pipeline_id_present:Boolean(s.circleci_pipeline_id),error:s.error||null}));
assert.ok([200,202].includes(sr.status),`check dispatch HTTP ${sr.status}: ${JSON.stringify(s)}`);
assert.equal(s.ok,true,`check dispatch rejected: ${JSON.stringify(s)}`);

const deadline=Date.now()+2*60*1000;let last=null;
while(Date.now()<deadline){
  await sleep(5000);
  const r=await fetch(BASE,{headers:{accept:"application/json"}});const b=await read(r);last=b;const t=b?.task||{};
  console.log(JSON.stringify({phase:"poll",http:r.status,status:t.status||null,stage:t.bridge_stage||null,failure_class:t.failure_class||null,verification_ok:t.verification_ok===true,result_digest_present:t.result_digest_present===true,retrieved:t.bridge_result_retrieved===true,error:t.error||null}));
  assert.equal(r.status,200,`status HTTP ${r.status}: ${JSON.stringify(b)}`);
  if(t.status==="completed"){
    assert.equal(t.verification_ok,true,"completed without verification");
    assert.equal(t.bridge_result_retrieved,true,"completed without retrieval marker");
    console.log(JSON.stringify({ok:true,suite:"baidu-check-after-path-fix",outcome:"completed"}));
    process.exit(0);
  }
  if(t.status==="failed"){
    assert.match(String(t.failure_class||""),/^BAIDU_[A-Z0-9_]+$/,"safe failure class missing");
    console.log(JSON.stringify({ok:true,suite:"baidu-check-after-path-fix",outcome:"classified_failure",failure_class:t.failure_class}));
    process.exit(0);
  }
}
throw new Error(`CHECK_DIAGNOSTIC_TIMEOUT:${JSON.stringify(last)}`);
