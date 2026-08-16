import assert from "node:assert/strict";
import fs from "node:fs";
import {AUTONOMY_POLICY,BAIDU_RUNTIME_POLICY} from "../src/provider-autonomy.js";

const autonomy=fs.readFileSync(new URL("../src/provider-autonomy.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const baidu=fs.readFileSync(new URL("../src/baidu-circleci.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

for(const state of ["VERIFIED","DEGRADED","QUARANTINED","CANDIDATE","DISABLED"])assert.match(autonomy,new RegExp(`"${state}"`));
assert.equal(AUTONOMY_POLICY.free_only,true);
assert.equal(AUTONOMY_POLICY.paid_fallback,false);
assert.equal(AUTONOMY_POLICY.scheduled_gpu_canary,false);
assert.equal(AUTONOMY_POLICY.quarantine_after_consecutive_failures,2);
assert.equal(AUTONOMY_POLICY.recover_after_consecutive_successes,2);
assert.equal(AUTONOMY_POLICY.user_routine_maintenance_required,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_runtime,"paddle2.5_py3.10");
assert.deepEqual(BAIDU_RUNTIME_POLICY.quarantined_runtimes,["paddle2.6_py3.10"]);
assert.equal(BAIDU_RUNTIME_POLICY.production_runtime,null);

assert.match(admin,/async scheduled\(controller,env,ctx\)/);
assert.match(admin,/runAutonomySweep\(app,env,ctx\)/);
assert.match(admin,/\/v1\/admin\/autonomy/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.match(wrangler,/provider-autonomy-contract\.mjs/);

assert.match(baidu,/baidu_payment:"coupon"/);
assert.match(baidu,/free_only:true/);
assert.match(baidu,/paid_fallback:false/);
assert.match(baidu,/acoin_allowed:false/);
assert.match(baidu,/runtime_candidate:"paddle2\.5_py3\.10"/);
assert.match(baidu,/runtime_quarantined:\["paddle2\.6_py3\.10"\]/);
assert.match(baidu,/route_eligible:configured&&e2eVerified/);
assert.doesNotMatch(baidu,/acoin_allowed:true/);

assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.5_py3\.10"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);

console.log(JSON.stringify({ok:true,suite:"provider-autonomy-contract",free_only:true,daily_control_plane:true,scheduled_gpu_canary:false,baidu_candidate:"paddle2.5_py3.10",baidu_e2e_gate_preserved:true}));
