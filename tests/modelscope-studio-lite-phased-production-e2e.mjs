import assert from "node:assert/strict";

const BASE="https://compute-worker.a15280020511.workers.dev";
const HEADER="studio-lite-once-v2-20260817";
const headers={accept:"application/json","x-three-center-selftest":HEADER};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(path,{method="GET",timeout=45000}={}){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(`${BASE}${path}`,{method,headers,signal:c.signal});
    const body=await r.json().catch(()=>null);
    return{status:r.status,body};
  }finally{clearTimeout(timer)}
}

let stopResult=null;
try{
  const prep=await call("/v1/selftest/modelscope-studio-lite-prepare-once",{method:"POST",timeout:90000});
  assert.equal(prep.status,200,`prepare HTTP ${prep.status}: ${JSON.stringify(prep.body)}`);
  assert.equal(prep.body?.ok,true);
  assert.equal(prep.body?.stage,"prepared");
  assert.equal(prep.body?.hardware?.name,"platform/2v-cpu-16g-mem");
  assert.equal(prep.body?.hardware?.resource_type,"free");
  assert.ok(["update","create"].includes(prep.body?.upload_action));
  assert.equal(prep.body?.free_only,true);
  assert.equal(prep.body?.paid_fallback,false);

  const dep=await call("/v1/selftest/modelscope-studio-lite-deploy-once",{method:"POST",timeout:45000});
  assert.equal(dep.status,200,`deploy HTTP ${dep.status}: ${JSON.stringify(dep.body)}`);
  assert.equal(dep.body?.ok,true);
  assert.equal(dep.body?.stage,"deployed");
  assert.equal(dep.body?.hardware?.name,"platform/2v-cpu-16g-mem");
  assert.equal(dep.body?.hardware?.resource_type,"free");

  let verified=null,last=null;
  for(let i=0;i<30;i++){
    await sleep(4000);
    last=await call("/v1/selftest/modelscope-studio-lite",{timeout:30000});
    if(last.status===200&&last.body?.runtime_e2e_verified===true){verified=last.body;break}
  }
  assert.ok(verified,`Studio Lite runtime receipt not verified: ${JSON.stringify(last?.body)}`);
  assert.equal(verified?.hardware?.name,"platform/2v-cpu-16g-mem");
  assert.equal(verified?.hardware?.resource_type,"free");
  assert.equal(verified?.runtime_receipt?.ok,true);
  assert.equal(verified?.runtime_receipt?.revision,"studio-lite-runtime-v2-20260817");
  assert.ok(Number(verified?.runtime_receipt?.cpu_effective)>=1.9);
  assert.ok(Number(verified?.runtime_receipt?.memory_gib_effective)>=14);
  assert.equal(Number(verified?.runtime_receipt?.nominal_cpu),2);
  assert.equal(Number(verified?.runtime_receipt?.nominal_memory_gb),16);
  assert.equal(verified?.runtime_receipt?.square_sum_correct,true);
  assert.match(String(verified?.runtime_receipt?.result_digest||""),/^[a-f0-9]{64}$/i);
  assert.equal(verified?.free_only,true);
  assert.equal(verified?.paid_fallback,false);
  assert.equal(verified?.secrets_redacted,true);

  stopResult=await call("/v1/selftest/modelscope-studio-lite-stop-once",{method:"POST",timeout:45000});
  assert.equal(stopResult.status,200,`stop HTTP ${stopResult.status}: ${JSON.stringify(stopResult.body)}`);
  assert.equal(stopResult.body?.ok,true);
  assert.equal(stopResult.body?.stage,"stopped");

  console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-phased-production-e2e",target_hardware:"platform/2v-cpu-16g-mem",resource_type:"free",cpu_effective:verified.runtime_receipt.cpu_effective,memory_gib_effective:verified.runtime_receipt.memory_gib_effective,nominal_cpu:verified.runtime_receipt.nominal_cpu,nominal_memory_gb:verified.runtime_receipt.nominal_memory_gb,square_sum_correct:true,result_digest:verified.runtime_receipt.result_digest,stop_http_status:stopResult.body.stop_http_status,phased_runner:true,idempotent_upload:true,free_only:true,paid_fallback:false,secrets_redacted:true}));
}finally{
  if(!stopResult){
    try{await call("/v1/selftest/modelscope-studio-lite-stop-once",{method:"POST",timeout:45000})}catch{}
  }
}
