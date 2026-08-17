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
  "result_digest"
]) assert.ok(studio.includes(literal),`Missing Studio Lite safety contract: ${literal}`);

for(const literal of [
  "/v1/selftest/modelscope-studio-lite",
  "/v1/admin/modelscope/studio-lite-bootstrap",
  "url.hostname!==\"compute.internal\""
]) assert.ok(entry.includes(literal),`Missing Studio Lite control-plane contract: ${literal}`);

assert.ok(!entry.includes("/v1/selftest/modelscope-studio-lite-bootstrap-once"),"Temporary public Studio Lite bootstrap endpoint must remain removed after acceptance");
assert.ok(!entry.includes("studio-lite-once-v1-20260817"),"Temporary Studio Lite acceptance header must remain removed after acceptance");
assert.ok(!wrangler.includes("*/5 * * * *"),"Studio Lite acceptance must not install a recurring 5-minute bootstrap cron");
assert.ok(!entry.includes('req.method===\"POST\"&&url.pathname===\"/v1/selftest/modelscope-studio-lite\"'),"Public Studio Lite status endpoint must remain read-only");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-lite-cpu-runner-contract",module_imported:true,target_hardware:"platform/2v-cpu-16g-mem",nominal_cpu:2,nominal_memory_gb:16,min_effective_cpu:1.9,min_effective_memory_gib:14,free_only:true,paid_fallback:false,private_studio:true,public_bootstrap:false,internal_bootstrap:true,recurring_bootstrap:false}));
