import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const workflow="modelscope-studio-lite-runner";
const instanceId="ms-lite-final-acceptance-v2-20260817";
const revision="studio-lite-runtime-v2-20260817";
const run=args=>spawnSync("npx",["wrangler",...args],{encoding:"utf8",timeout:45000,env:{...process.env,CI:"true"}});
const clean=s=>String(s||"").replace(/[A-Za-z0-9_=-]{32,}/g,"[redacted]").slice(0,5000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=(text,key)=>{const m=text.match(new RegExp(`${key}[^0-9]{0,40}([0-9]+(?:\\.[0-9]+)?)`,"i"));return m?Number(m[1]):NaN};

let finalText="";
for(let i=0;i<12;i++){
  if(i>0)await sleep(15000);
  const d=run(["workflows","instances","describe",workflow,instanceId,"--truncate-output-limit","20000"]);
  const text=String(d.stdout||"")+"\n"+String(d.stderr||"");
  finalText=text;
  if(d.status!==0){
    if(i===11)throw new Error(`Fixed Workflow instance describe failed: ${clean(text)}`);
    continue;
  }
  if(/Status:\s*(Errored|Failed|Terminated)/i.test(text)||/Success:\s*No/i.test(text)){
    throw new Error(`Fixed Workflow instance failed: ${clean(text)}`);
  }
  if(/Status:\s*Completed/i.test(text)&&/Success:\s*Yes/i.test(text))break;
}

assert.match(finalText,/Status:\s*Completed/i,"Workflow instance did not complete within the bounded describe window");
assert.match(finalText,/Success:\s*Yes/i,"Workflow instance did not complete successfully");
assert.ok(finalText.includes(revision),"Completed Workflow output is missing the required v2 runtime revision");
assert.ok(finalText.includes("platform/2v-cpu-16g-mem"),"Completed Workflow output is missing the exact free hardware target");
assert.match(finalText,/resource_type[^a-z0-9]{0,40}free/i,"Completed Workflow output does not prove free resource type");
assert.match(finalText,/runtime_e2e_verified[^a-z]{0,30}true/i,"Completed Workflow output does not prove runtime E2E verification");
assert.match(finalText,/square_sum_correct[^a-z]{0,30}true/i,"Completed Workflow output does not prove deterministic computation correctness");
assert.match(finalText,/free_only[^a-z]{0,30}true/i,"Completed Workflow output does not prove free-only policy");
assert.match(finalText,/paid_fallback[^a-z]{0,30}false/i,"Completed Workflow output does not prove paid fallback is disabled");

const cpu=num(finalText,"cpu_effective");
const mem=num(finalText,"memory_gib_effective");
const nominalCpu=num(finalText,"nominal_cpu");
const nominalMem=num(finalText,"nominal_memory_gb");
assert.ok(cpu>=1.9,`effective CPU below threshold or missing: ${cpu}`);
assert.ok(mem>=14,`effective memory below threshold or missing: ${mem}`);
assert.equal(nominalCpu,2,"nominal CPU must be 2");
assert.equal(nominalMem,16,"nominal memory must be 16 GB");
const digest=finalText.match(/result_digest[^a-f0-9]{0,80}([a-f0-9]{64})/i)?.[1]||"";
assert.match(digest,/^[a-f0-9]{64}$/i,"Completed Workflow output is missing a valid result SHA-256 digest");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-workflow-describe-gate",workflow,instance_id:instanceId,fixed_id:true,control_plane_read_only:true,runtime_e2e_verified:true,target_hardware:"platform/2v-cpu-16g-mem",resource_type:"free",cpu_effective:cpu,memory_gib_effective:mem,nominal_cpu:nominalCpu,nominal_memory_gb:nominalMem,square_sum_correct:true,result_digest:digest,revision,free_only:true,paid_fallback:false,secrets_redacted:true}));
