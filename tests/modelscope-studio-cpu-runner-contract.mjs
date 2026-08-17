import assert from "node:assert/strict";
import fs from "node:fs";

const studio=fs.readFileSync(new URL("../src/modelscope-studio.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");

await import("../src/modelscope-studio.js");

for(const literal of [
  "three-center-cpu-runner",
  "MIN_CPU=8",
  "MIN_MEMORY_GB=30",
  "platform/",
  "paid/",
  "paid_fallback:false",
  "visibility:\"private\"",
  "/repos/studios/",
  "/commit/master",
  "THREE_CENTER_MODELSCOPE_CPU_RUNTIME:",
  "square_sum_correct",
  "/stop"
]) assert.ok(studio.includes(literal),`Missing full Studio safety contract: ${literal}`);

for(const literal of [
  "/v1/selftest/modelscope-studio",
  "getModelScopeStudioStatus"
]) assert.ok(entry.includes(literal),`Missing read-only full Studio status contract: ${literal}`);

assert.ok(!entry.includes("runModelScopeStudioBootstrap"),"Legacy 8-core bootstrap must not be production-routable");
assert.ok(!entry.includes("/v1/admin/modelscope/studio-bootstrap"),"Legacy 8-core admin bootstrap route must remain removed");
assert.ok(!entry.includes("STUDIO_BOOTSTRAP_CRON"),"Legacy 8-core Studio must not have a scheduled bootstrap handler");
assert.ok(!entry.includes('req.method===\"POST\"&&url.pathname===\"/v1/selftest/modelscope-studio\"'),"Public full Studio selftest must remain read-only");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-cpu-runner-contract",module_imported:true,min_cpu:8,min_memory_gb:30,free_only:true,paid_fallback:false,private_studio:true,public_write_endpoint:false,bootstrap_routable:false,legacy_scheduled_bootstrap:false}));
