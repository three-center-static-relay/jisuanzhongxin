import assert from "node:assert/strict";
import fs from "node:fs";

const index=fs.readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
const production=fs.readFileSync(new URL("../src/production.js",import.meta.url),"utf8");
const modal=fs.readFileSync(new URL("../src/modal.js",import.meta.url),"utf8");
const autonomy=fs.readFileSync(new URL("../src/provider-autonomy.js",import.meta.url),"utf8");

assert.match(index,/verified_provider_routes_only:true/);
assert.match(index,/WOLFRAM_LIVE_E2E_VERIFIED/);
assert.match(index,/PROVIDER_NOT_VERIFIED/);
assert.match(index,/baidu_aistudio_route_eligible:false/);
assert.match(index,/quarantined-paddle2\.6-paddle2\.5-candidate-paddle2\.4/);
assert.match(index,/production_runtime:BAIDU_RUNTIME_POLICY\.production_runtime/);
assert.match(index,/automatic_candidate_execution:BAIDU_RUNTIME_POLICY\.automatic_candidate_execution/);
assert.match(index,/route_eligible:kaggleConfigured/);
assert.match(index,/route_eligible:wolframConfigured&&wolframVerified/);

assert.match(production,/route_eligible:who\.active===true/);
assert.match(production,/route_eligible:false,error_class:String\(e\?\.message\|\|"KAGGLE_PROBE_FAILED"\)/);
assert.match(production,/route_eligible:Boolean\(env\.KAGGLE_API_TOKEN\)/);
assert.match(production,/acceptance_state:"manual-auth-only-not-production"/);
assert.match(production,/unattended_e2e_verified:false,route_eligible:false/);

assert.match(modal,/historically_verified:true/);
assert.match(modal,/route_eligibility:"live-health-required"/);
assert.match(modal,/route_eligible:ok/);
assert.match(modal,/route_eligible:checksumOk/);
assert.match(modal,/route_eligible:gpuOk/);

assert.match(autonomy,/route_requires_live_health:true/);
assert.match(autonomy,/health\?\.route_eligible===true/);

console.log(JSON.stringify({ok:true,suite:"provider-route-truth",verified_only:true,kaggle_live_health_gate:true,modal_live_health_gate:true,wolfram_live_e2e_gate:true,baidu_fail_closed:true}));
