import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const provider=fs.readFileSync(new URL("../src/modelscope-compute.js",import.meta.url),"utf8");

assert.match(entry,/\/v1\/selftest\/modelscope-runtime/);
assert.match(entry,/secret_present/);
assert.match(entry,/authenticated/);
assert.match(entry,/free_hardware_verified/);
assert.match(entry,/free_cpu_verified/);
assert.match(entry,/secrets_redacted:true/);
assert.doesNotMatch(entry,/MODELSCOPE_TOKEN\s*:/);
assert.match(provider,/\/users\/me/);
assert.match(provider,/\/studios\/hardware/);
assert.match(provider,/MODELSCOPE_TOKEN/);
assert.match(provider,/paid_fallback:false/);

console.log(JSON.stringify({ok:true,suite:"modelscope-live-selftest-contract",secrets_redacted:true,live_auth_probe:true,free_only:true}));
