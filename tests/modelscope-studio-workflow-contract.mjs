import assert from "node:assert/strict";
import fs from "node:fs";

const workflow=fs.readFileSync(new URL("../src/modelscope-studio-workflow.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

for(const literal of [
  'from "cloudflare:workers"',
  "WorkflowEntrypoint",
  "ModelScopeStudioLiteWorkflow",
  'platform/2v-cpu-16g-mem',
  'studio-lite-runtime-v2-20260817',
  'check prior verified Studio receipt',
  'stage:"already-verified"',
  'step.sleep',
  'for(let i=0;i<5;i++)',
  '"20 seconds"',
  'rollback:',
  'rollbackConfig:STOP_RETRY',
  'stopModelScopeStudioLite',
  'subrequest_budget_max:50',
  'polling_rounds_max:5',
  'paid_fallback:false',
  'free_only:true'
]) assert.ok(workflow.includes(literal),`Missing Workflow safety contract: ${literal}`);

for(const literal of [
  '"workflows"',
  '"name":"modelscope-studio-lite-runner"',
  '"binding":"MODELSCOPE_STUDIO_WORKFLOW"',
  '"class_name":"ModelScopeStudioLiteWorkflow"'
]) assert.ok(wrangler.includes(literal),`Missing Workflow binding: ${literal}`);

for(const literal of [
  'export {CenterGate,ModelScopeStudioLiteWorkflow}',
  '/v1/admin/modelscope/studio-lite/run',
  '/v1/admin/modelscope/studio-lite/workflow',
  'url.hostname!=="compute.internal"'
]) assert.ok(entry.includes(literal),`Missing internal Workflow control contract: ${literal}`);

assert.ok(!wrangler.includes('"schedules"'),"Permanent Studio Lite Workflow must remain demand-driven");
assert.ok(!entry.includes('/v1/selftest/modelscope-studio-lite-workflow-once'),"Public Workflow trigger must remain absent");
assert.ok(!workflow.includes('retries:{limit:5'),"Workflow must not inherit high retry amplification under the Free 50-subrequest budget");
assert.ok(workflow.includes('const ONE_ATTEMPT={retries:{limit:1'),"Prepare/deploy attempts must stay single-attempt");
assert.ok(workflow.includes('const STATUS_ATTEMPT={retries:{limit:1'),"Status reads must stay single-attempt");
assert.ok(workflow.includes('const STOP_RETRY={retries:{limit:2'),"Stop may retry once but must remain bounded");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-workflow-contract",workflow:"modelscope-studio-lite-runner",binding:"MODELSCOPE_STUDIO_WORKFLOW",demand_driven:true,public_trigger:false,idempotent_acceptance_guard:true,poll_rounds:5,poll_sleep_seconds:20,subrequest_budget_max:50,explicit_stop:true,rollback_stop:true,free_only:true,paid_fallback:false}));
