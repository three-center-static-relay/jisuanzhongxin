import assert from "node:assert/strict";
import fs from "node:fs";
import {MODELSCOPE_RUNTIME_REQUIREMENTS,evaluateModelScopeRuntime} from "../src/modelscope-compute.js";

const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const monitor=fs.readFileSync(new URL("../src/modelscope-runtime-monitor.js",import.meta.url),"utf8");

assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.free_only,true);
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_cpu_cores,8);
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_memory_gb,30);
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_os,"ubuntu");
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_os_version,"22.04");
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.minimum_python,"3.12");
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.keep_last_verified_until_candidate_pass,true);
assert.equal(MODELSCOPE_RUNTIME_REQUIREMENTS.upgrade_policy,"candidate-canary-promote");

const pass=evaluateModelScopeRuntime({free:true,cpu_cores:8,memory_gb:32,os_name:"Ubuntu",os_version:"22.04",python_version:"3.12.2",torch_version:"2.3.1"});
assert.equal(pass.verified,true);
assert.equal(pass.compatible,true);
assert.deepEqual(pass.alerts,[]);

const newer=evaluateModelScopeRuntime({billing_mode:"free",cpu_cores:16,memory_gb:64,os_name:"Ubuntu",os_version:"24.04",python_version:"3.13.1",torch_version:"2.6.0"});
assert.equal(newer.compatible,true,"newer compatible runtimes must not trigger needless downgrade alerts");

const fail=evaluateModelScopeRuntime({free:false,cpu_cores:4,memory_gb:16,os_name:"Ubuntu",os_version:"20.04",python_version:"3.10",torch_version:"2.0"});
assert.equal(fail.compatible,false);
assert.ok(fail.alerts.includes("BILLING_REQUIRED"));
assert.ok(fail.alerts.includes("RUNTIME_BASELINE_NOT_MET"));

assert.match(admin,/runModelScopeRuntimeSweep/);
assert.match(admin,/\/v1\/admin\/modelscope/);
assert.match(admin,/user_action_required/);
assert.match(monitor,/FREE_CPU_BASELINE_UNVERIFIED/);
assert.match(monitor,/RUNTIME_BASELINE_NOT_MET/);
assert.match(monitor,/hard_alerts/);

console.log(JSON.stringify({ok:true,suite:"modelscope-runtime-alert-contract",free_only:true,baseline:"8c-30gb-ubuntu22.04-python3.12-torch2.3+",upgrade_policy:"candidate-canary-promote",alerts:true}));
