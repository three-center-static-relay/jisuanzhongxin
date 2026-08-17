import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const workflow="modelscope-studio-lite-runner";
const instanceId="ms-lite-final-acceptance-v2-20260817";
const params=JSON.stringify({trigger:"final-acceptance",free_only:true,requested_at:"2026-08-17"});
const run=args=>spawnSync("npx",["wrangler",...args],{encoding:"utf8",timeout:60000,env:{...process.env,CI:"true"}});
const clean=s=>String(s||"").replace(/[A-Za-z0-9_=-]{32,}/g,"[redacted]").slice(0,3000);

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
console.log(JSON.stringify({ok:true,suite:"modelscope-studio-workflow-trigger-once",workflow,instance_id:instanceId,mode,fixed_id:true,free_only:true,paid_fallback:false,secrets_redacted:true}));
