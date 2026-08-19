import assert from "node:assert/strict";
import fs from "node:fs";

const studio=fs.readFileSync(new URL("../src/modelscope-studio-lite.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

await import("../src/modelscope-studio-lite.js");

for(const literal of [
  "three-center-cpu-lite",
  "platform/2v-cpu-16g-mem",
  "TARGET_CPU=2",
  "TARGET_MEMORY_GB=16",
  "MIN_EFFECTIVE_CPU=1.9",
  "MIN_EFFECTIVE_MEMORY_GIB=14",
  "resource_type",
  'type===\"free\"',
  "paid_fallback:false",
  'visibility:\"private\"',
  "/deploy",
  "/stop",
  "/logs/run",
  "THREE_CENTER_MODELSCOPE_LITE_RUNTIME:",
  "square_sum_correct",
  "result_digest",
  "prepareModelScopeStudioLite",
  "deployModelScopeStudioLite",
  "stopModelScopeStudioLite",
  'commitAppAction(t,owner,\"update\")',
  'commitAppAction(t,owner,\"create\")',
  "stop_requires_hardware_catalog:false",
  "phased_runner:true",
  "idempotent_upload:true"
]) assert.ok(studio.includes(literal),`Missing Studio Lite safety contract: ${literal}`);

for(const literal of [
  "/v1/selftest/modelscope-studio-lite",
  "/v1/admin/modelscope/studio-lite/status",
  "/v1/admin/modelscope/studio-lite/prepare",
  "/v1/admin/modelscope/studio-lite/deploy",
  "/v1/admin/modelscope/studio-lite/stop",
  "/v1/admin/modelscope/studio-lite-bootstrap",
  "/v1/admin/modelscope/studio-lite/run",
  "/v1/admin/modelscope/studio-lite/workflow",
  "MODELSCOPE_STUDIO_WORKFLOW",
  "compute.internal"
]) assert.ok(entry.includes(literal),`Missing Studio Lite internal control-plane contract: ${literal}`);

for(const forbidden of [
  "/v1/selftest/modelscope-studio-lite-prepare-once",
  "/v1/selftest/modelscope-studio-lite-deploy-once",
  "/v1/selftest/modelscope-studio-lite-stop-once",
  "/v1/selftest/modelscope-studio-lite-bootstrap-once",
  "studio-lite-once-v1-20260817",
  "studio-lite-once-v2-20260817"
]) assert.ok(!entry.includes(forbidden),`Public Studio Lite write surface must be absent: ${forbidden}`);

assert.ok(!wrangler.includes('"schedules"'),"Permanent Studio Lite Workflow must not self-schedule");
assert.ok(!entry.includes('req.method===\"POST\"&&url.pathname===\"/v1/selftest/modelscope-studio-lite\"'),"Public Studio Lite status endpoint must remain read-only");
assert.ok(entry.indexOf('url.pathname===\"/v1/admin/modelscope/studio-lite/stop\"')>=0,"Internal emergency stop route must exist");
assert.ok(!studio.includes("private:true"),"Obsolete ModelScope private:true settings field must not return");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-cpu-runner-contract",module_imported:true,target_hardware:"platform/2v-cpu-16g-mem",nominal_cpu:2,nominal_memory_gb:16,min_effective_cpu:1.9,min_effective_memory_gib:14,free_only:true,paid_fallback:false,private_studio:true,visibility_contract:"private",phased_runner:true,idempotent_upload:true,stop_independent_of_hardware_catalog:true,public_write_surface:false,internal_workflow_control:true,demand_driven:true}));
