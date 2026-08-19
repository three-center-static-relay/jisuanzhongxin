import fs from "node:fs";

const src=fs.readFileSync(new URL("../src/aliyun-fc-sandbox.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");

const required=[
  "ALIYUN_FC_SANDBOX_API_KEY",
  "ALIYUN_FC_SANDBOX_REGION",
  "X-API-Key",
  "/templates",
  "route_eligible:false",
  "runtime_e2e_verified:false",
  "billing_policy_verified:false",
  "production_routing:false",
  "CANDIDATE_NOT_PROMOTED"
];
for(const token of required){if(!src.includes(token))throw new Error(`missing ${token}`)}
if(!entry.includes("maybeHandleAliyunFCSandbox"))throw new Error("Aliyun router not wired into production entry");
if(/console\.log|secret_echo\s*:\s*true/.test(src))throw new Error("unsafe secret/log surface");
console.log("aliyun-fc-sandbox-contract: PASS");
