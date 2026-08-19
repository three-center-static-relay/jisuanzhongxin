import fs from "node:fs";

const src=fs.readFileSync(new URL("../src/aliyun-fc-sandbox.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");

const required=[
  "ALIYUN_FC_SANDBOX_API_KEY",
  "ALIYUN_FC_SANDBOX_REGION",
  "X-API-Key",
  "/templates",
  "runtime_e2e_verified:true",
  "billing_policy_verified:true",
  "paid_execution:true",
  "explicit_paid_ack_required:true",
  "automatic_global_routing:false",
  "paid_fallback:false",
  'production_routing:"explicit-only"',
  'route_scope:"explicit-paid-internal-only"',
  'body?.allow_paid!==true',
  "PAID_EXECUTION_ACK_REQUIRED",
  "MAX_EXEC_SECONDS=60",
  "sandbox.kill()"
];
for(const token of required){if(!src.includes(token))throw new Error(`missing ${token}`)}
if(!entry.includes("maybeHandleAliyunFCSandbox"))throw new Error("Aliyun router not wired into production entry");
if(src.includes("CANDIDATE_NOT_PROMOTED"))throw new Error("obsolete Aliyun candidate gate remains");
if(/console\.log|secret_echo\s*:\s*true/.test(src))throw new Error("unsafe secret/log surface");
console.log("aliyun-fc-sandbox-contract: PASS");
