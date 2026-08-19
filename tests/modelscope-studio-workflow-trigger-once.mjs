import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const workflow="modelscope-studio-lite-runner";
const run=args=>spawnSync("npx",["wrangler",...args],{encoding:"utf8",timeout:45000,env:{...process.env,CI:"true"}});
const clean=s=>String(s||"").replace(/[A-Za-z0-9_=-]{32,}/g,"[redacted]").slice(0,3000);

const r=run(["workflows","list"]);
const text=String(r.stdout||"")+"\n"+String(r.stderr||"");
assert.equal(r.status,0,`Wrangler cannot list production Workflows: ${clean(text)}`);
assert.ok(text.includes(workflow),`Workflow control plane is readable but ${workflow} is not listed: ${clean(text)}`);

console.log(JSON.stringify({ok:true,suite:"modelscope-workflow-control-plane-readability",workflow,control_plane_readable:true,workflow_listed:true,no_instance_read:true,no_trigger:true,no_compute:true}));
