import assert from "node:assert/strict";
import fs from "node:fs";

const studio=fs.readFileSync(new URL("../src/modelscope-studio.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

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
]) assert.ok(studio.includes(literal),`Missing Studio safety contract: ${literal}`);

for(const literal of [
  "/v1/selftest/modelscope-studio",
  "/v1/admin/modelscope/studio-bootstrap",
  "url.hostname!==\"compute.internal\"",
  "STUDIO_BOOTSTRAP_CRON=\"*/5 * * * *\""
]) assert.ok(entry.includes(literal),`Missing admin/cron contract: ${literal}`);

assert.ok(wrangler.includes("*/5 * * * *"),"Temporary Studio bootstrap cron not configured");
assert.ok(!entry.includes('req.method==="POST"&&url.pathname==="/v1/selftest/modelscope-studio"'),"Public selftest must not be a write endpoint");

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-cpu-runner-contract",module_imported:true,min_cpu:8,min_memory_gb:30,free_only:true,paid_fallback:false,private_studio:true,public_write_endpoint:false,temporary_cron:true}));
