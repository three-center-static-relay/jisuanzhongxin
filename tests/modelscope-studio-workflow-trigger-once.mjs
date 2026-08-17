import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const workflow="modelscope-studio-lite-runner";
const primaryId="ms-lite-final-acceptance-v2-20260817";
const repairId="ms-lite-final-acceptance-v2-repair1-20260817";
const revision="studio-lite-runtime-v2-20260817";
const params=JSON.stringify({trigger:"final-acceptance",free_only:true,requested_at:"2026-08-17"});
const run=args=>spawnSync("npx",["wrangler",...args],{encoding:"utf8",timeout:60000,env:{...process.env,CI:"true"}});
const clean=s=>String(s||"").replace(/[A-Za-z0-9_=-]{32,}/g,"[redacted]").slice(0,6000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=(text,key)=>{const m=text.match(new RegExp(`${key}[^0-9]{0,40}([0-9]+(?:\\.[0-9]+)?)`,"i"));return m?Number(m[1]):NaN};
const describe=id=>run(["workflows","instances","describe",workflow,id,"--truncate-output-limit","20000"]);
const output=r=>String(r?.stdout||"")+"\n"+String(r?.stderr||"");
const failed=text=>/Status:\s*(Errored|Failed|Terminated)/i.test(text)||/Success:\s*No/i.test(text);
const complete=text=>/Status:\s*Completed/i.test(text)&&/Success:\s*Yes/i.test(text);

function triggerIfMissing(id){
  let d=describe(id),text=output(d);
  if(d.status===0)return{id,mode:"existing-instance",result:d,text};
  const t=run(["workflows","trigger",workflow,params,"--id",id]);
  if(t.status===0)return{id,mode:"triggered-if-missing",result:t,text:output(t)};
  d=describe(id);text=output(d);
  if(d.status===0)return{id,mode:"existing-after-trigger-race",result:d,text};
  throw new Error(`Workflow instance is absent/unreadable and one fixed trigger attempt failed. id=${id} trigger=${clean(output(t))} describe=${clean(text)}`);
}

let candidate=triggerIfMissing(primaryId);
if(candidate.result.status===0&&failed(candidate.text))candidate=triggerIfMissing(repairId);
if(candidate.result.status===0&&failed(candidate.text))throw new Error(`Both deterministic Workflow acceptance instances are terminal failures. primary=${primaryId} repair=${repairId} repair_status=${clean(candidate.text)}`);

let finalText=candidate.text;
for(let i=0;i<18;i++){
  const d=describe(candidate.id),text=output(d);finalText=text;
  if(d.status!==0){if(i===17)throw new Error(`Fixed Workflow instance describe failed: id=${candidate.id} ${clean(text)}`)}
  else{
    if(failed(text))throw new Error(`Fixed Workflow instance failed: id=${candidate.id} ${clean(text)}`);
    if(complete(text))break;
  }
  if(i<17)await sleep(15000);
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

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-workflow-idempotent-gate",workflow,instance_id:candidate.id,primary_id:primaryId,repair_id:repairId,mode:candidate.mode,fixed_ids:true,trigger_only_if_missing:true,terminal_primary_uses_single_repair_id:true,runtime_e2e_verified:true,target_hardware:"platform/2v-cpu-16g-mem",resource_type:"free",cpu_effective:cpu,memory_gib_effective:mem,nominal_cpu:nominalCpu,nominal_memory_gb:nominalMem,square_sum_correct:true,result_digest:digest,revision,free_only:true,paid_fallback:false,secrets_redacted:true}));
