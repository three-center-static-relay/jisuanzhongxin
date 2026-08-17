import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const workflow="modelscope-studio-lite-runner";
const instanceId="ms-lite-final-acceptance-v2-20260817";
const params=JSON.stringify({trigger:"final-acceptance",free_only:true,requested_at:"2026-08-17"});
const statusUrl="https://compute-worker.a15280020511.workers.dev/v1/selftest/modelscope-studio-lite";
const run=args=>spawnSync("npx",["wrangler",...args],{encoding:"utf8",timeout:60000,env:{...process.env,CI:"true"}});
const clean=s=>String(s||"").replace(/[A-Za-z0-9_=-]{32,}/g,"[redacted]").slice(0,3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

let trigger=run(["workflows","trigger",workflow,params,"--id",instanceId]);
let mode="triggered";
if(trigger.status!==0){
  const describe=run(["workflows","instances","describe",workflow,instanceId,"--step-output=false"]);
  if(describe.status!==0){
    throw new Error(`Workflow trigger failed and fixed instance is not readable. trigger=${clean(trigger.stderr||trigger.stdout)} describe=${clean(describe.stderr||describe.stdout)}`);
  }
  trigger=describe;
  mode="existing-instance";
}
assert.equal(trigger.status,0);

let verified=null,last=null;
for(let i=0;i<16;i++){
  if(i>0)await sleep(15000);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(statusUrl,{method:"GET",headers:{accept:"application/json"},signal:controller.signal});
    const body=await r.json().catch(()=>null);
    last={status:r.status,body};
    if(r.status===200&&body?.runtime_e2e_verified===true&&body?.runtime_receipt?.revision==="studio-lite-runtime-v2-20260817"){
      verified=body;
      break;
    }
  }catch(e){last={status:0,error:String(e?.name||e?.message||e)}}
  finally{clearTimeout(timer)}
}

assert.ok(verified,`Fixed Workflow instance did not produce a verified v2 Studio Lite receipt: ${clean(JSON.stringify(last))}`);
assert.equal(verified?.ok,true);
assert.equal(verified?.selftest,"modelscope-studio-lite");
assert.equal(verified?.route_eligible,true);
assert.equal(verified?.target_hardware,"platform/2v-cpu-16g-mem");
assert.equal(verified?.hardware?.name,"platform/2v-cpu-16g-mem");
assert.equal(verified?.hardware?.resource_type,"free");
assert.equal(verified?.runtime_receipt?.ok,true);
assert.ok(Number(verified?.runtime_receipt?.cpu_effective)>=1.9);
assert.ok(Number(verified?.runtime_receipt?.memory_gib_effective)>=14);
assert.equal(Number(verified?.runtime_receipt?.nominal_cpu),2);
assert.equal(Number(verified?.runtime_receipt?.nominal_memory_gb),16);
assert.equal(verified?.runtime_receipt?.square_sum_correct,true);
assert.match(String(verified?.runtime_receipt?.result_digest||""),/^[a-f0-9]{64}$/i);
assert.equal(verified?.free_only,true);
assert.equal(verified?.paid_fallback,false);
assert.equal(verified?.secrets_redacted,true);

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-workflow-trigger-once",workflow,instance_id:instanceId,mode,fixed_id:true,runtime_e2e_verified:true,target_hardware:verified.hardware.name,resource_type:verified.hardware.resource_type,cpu_effective:verified.runtime_receipt.cpu_effective,memory_gib_effective:verified.runtime_receipt.memory_gib_effective,nominal_cpu:verified.runtime_receipt.nominal_cpu,nominal_memory_gb:verified.runtime_receipt.nominal_memory_gb,square_sum_correct:true,result_digest:verified.runtime_receipt.result_digest,revision:verified.runtime_receipt.revision,free_only:true,paid_fallback:false,secrets_redacted:true}));
