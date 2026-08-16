import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");

assert.match(entry,/MODAL_PUBLIC_HEALTH_TTL_MS=300000/);
assert.match(entry,/let modalPublicHealthCache=\{at:0,value:null\}/);
assert.match(entry,/async function publicModalHealth\(env\)/);
assert.match(entry,/cached_health:true,cache_ttl_ms:MODAL_PUBLIC_HEALTH_TTL_MS/);
assert.match(entry,/cached_health:false,cache_ttl_ms:MODAL_PUBLIC_HEALTH_TTL_MS/);
assert.match(entry,/\/v1\/providers\/modal\/health.*publicModalHealth\(env\)/s);
assert.match(entry,/async function requireModalLiveHealth\(env\)\{\s*const health=await modalHealth\(env\)/s);
assert.doesNotMatch(entry,/async function requireModalLiveHealth\(env\)\{\s*const health=await publicModalHealth\(env\)/s);
assert.match(entry,/health\.ok===true&&health\.route_eligible===true/);

console.log(JSON.stringify({ok:true,suite:"modal-public-health-cache",public_health_ttl_ms:300000,execution_health_live:true,route_gate_preserved:true,gpu_started:false}));
