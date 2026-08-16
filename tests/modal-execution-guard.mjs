import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");
const compute=fs.readFileSync(new URL("../src/modal-generic-compute.js",import.meta.url),"utf8");

assert.match(entry,/function internalExecutionOnly\(u\)\{return u\.hostname==="compute\.internal"\}/);
assert.match(entry,/Modal execution routes are service-binding internal only/);
assert.match(entry,/MODAL_LIVE_HEALTH_REQUIRED/);
assert.match(entry,/health\.ok===true&&health\.route_eligible===true/);
for(const path of ["compute","selftest/cpu","selftest/gpu"]){
  assert.ok(entry.includes(`u.pathname===\"/v1/providers/modal/${path}\"`));
}
assert.match(entry,/if\(!internalExecutionOnly\(u\)\)return denyExternalExecution\(\)/);
assert.match(entry,/const blocked=await requireModalLiveHealth\(env\);if\(blocked\)return blocked/);
assert.match(entry,/route\/plan/);
assert.match(entry,/execution_started:false/);
assert.match(compute,/\["sum","mean"\]/);
assert.match(compute,/MAX_VALUES=4096/);
assert.doesNotMatch(compute,/eval\(/);
assert.doesNotMatch(compute,/Function\(/);

console.log(JSON.stringify({ok:true,suite:"modal-execution-guard",internal_execution_only:true,live_health_gate:true,public_plan_no_execution:true,bounded_ops:["sum","mean"],gpu_started:false}));
