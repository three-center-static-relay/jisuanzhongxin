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
  "private:true",
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
  "/v1/selftest/modelscope-studio-lite-prepare-once",
  "/v1/selftest/modelscope-studio-lite-deploy-once",
  "/v1/selftest/modelscope-studio-lite-stop-once",
  "studio-lite-once-v2-20260817",
  "/v1/admin/modelscope/studio-lite/status",
  "/v1/admin/modelscope/studio-lite/prepare",
  "/v1/admin/modelscope/studio-lite/deploy",
  "/v1/admin/modelscope/studio-lite/stop",
  "/v1/admin/modelscope/studio-lite-bootstrap",
  "compute.internal"
]) assert.ok(entry.includes(literal),`Missing Studio Lite control-plane contract: ${literal}`);

assert.ok(!wrangler.includes("*/5 * * * *"),"Studio Lite acceptance must not install a recurring 5-minute bootstrap cron");
assert.ok(!entry.includes('req.method===\"POST\"&&url.pathname===\"/v1/selftest/modelscope-studio-lite\"'),"Public Studio Lite status endpoint must remain read-only");
assert.ok(entry.indexOf('url.pathname===\"/v1/admin/modelscope/studio-lite/stop\"')>=0,"Internal emergency stop route must exist");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-cpu-runner-contract",module_imported:true,target_hardware:"platform/2v-cpu-16g-mem",nominal_cpu:2,nominal_memory_gb:16,min_effective_cpu:1.9,min_effective_memory_gib:14,free_only:true,paid_fallback:false,private_studio:true,phased_runner:true,idempotent_upload:true,stop_independent_of_hardware_catalog:true,fixed_one_shot_gate:true,recurring_bootstrap:false}));
