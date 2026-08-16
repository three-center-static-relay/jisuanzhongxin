import assert from "node:assert/strict";
import fs from "node:fs";
import {AUTONOMY_POLICY,BAIDU_RUNTIME_POLICY} from "../src/provider-autonomy.js";

const autonomy=fs.readFileSync(new URL("../src/provider-autonomy.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const baidu=fs.readFileSync(new URL("../src/baidu-circleci.js",import.meta.url),"utf8");
const router=fs.readFileSync(new URL("../src/baidu-circleci-router.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../bridge/baidu/job/run.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

for(const state of ["VERIFIED","DEGRADED","QUARANTINED","CANDIDATE","DISABLED"])assert.match(autonomy,new RegExp(`"${state}"`));
assert.equal(AUTONOMY_POLICY.free_only,true);
assert.equal(AUTONOMY_POLICY.paid_fallback,false);
assert.equal(AUTONOMY_POLICY.scheduled_gpu_canary,false);
assert.equal(AUTONOMY_POLICY.quarantine_after_consecutive_failures,2);
assert.equal(AUTONOMY_POLICY.recover_after_consecutive_successes,2);
assert.equal(AUTONOMY_POLICY.user_routine_maintenance_required,false);
assert.equal(AUTONOMY_POLICY.route_requires_live_health,true);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_runtime,"paddle2.4_py3.7");
assert.deepEqual(BAIDU_RUNTIME_POLICY.quarantined_runtimes,["paddle2.6_py3.10","paddle2.5_py3.10"]);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.5_py3.10"].live_e2e_failures,2);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.5_py3.10"].latest_elapsed_seconds,195);
assert.equal(BAIDU_RUNTIME_POLICY.automatic_candidate_execution,false);
assert.equal(BAIDU_RUNTIME_POLICY.production_runtime,null);

assert.match(admin,/async scheduled\(controller,env,ctx\)/);
assert.match(admin,/runAutonomySweep\(app,env,ctx\)/);
assert.match(admin,/\/v1\/admin\/autonomy/);
assert.doesNotMatch(admin,/P25B_TRIGGER_CRON/);
assert.match(admin,/P24_TRIGGER_CRON="\* \* \* \* \*"/);
assert.match(admin,/production-entry-baidu-p24-e2e\.js/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*",\s*"\* \* \* \* \*"\]\s*\}/);
assert.match(wrangler,/baidu-p24-final-acceptance-contract\.mjs/);
assert.doesNotMatch(wrangler,/baidu-p25b-canary-contract\.mjs/);
assert.match(wrangler,/provider-autonomy-contract\.mjs/);

assert.match(autonomy,/health\?\.route_eligible===true/);
assert.match(autonomy,/meta\?\.historically_verified===true/);
assert.match(autonomy,/health\?\.ok===true&&health\?\.route_eligible===true/);
assert.match(autonomy,/route_eligible:routeEligible/);
assert.match(autonomy,/route_eligible:rec\.observation\?\.route_eligible===true/);

assert.match(baidu,/baidu_payment:"coupon"/);
assert.match(baidu,/free_only:true/);
assert.match(baidu,/paid_fallback:false/);
assert.match(baidu,/acoin_allowed:false/);
assert.match(baidu,/runtime_candidate:"paddle2\.4_py3\.7"/);
assert.match(baidu,/runtime_quarantined:\["paddle2\.6_py3\.10","paddle2\.5_py3\.10"\]/);
assert.match(baidu,/automatic_candidate_execution:false/);
assert.match(baidu,/route_eligible:configured&&e2eVerified/);
assert.doesNotMatch(baidu,/acoin_allowed:true/);

assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);
assert.match(bridge,/STATUS_PROBE_EVERY_POLLS = 2/);
assert.match(bridge,/check_impl\._query_pipeline\(token, job_id\)/);
assert.match(bridge,/BAIDU_JOB_TERMINAL_FAILED/);
assert.match(bridge,/stage="baidu_terminal_failed"/);
assert.match(bridge,/_runtime_failure_class\(result\)/);
assert.match(bridge,/BAIDU_RUNTIME_EXECUTION_ERROR/);

assert.match(runtime,/nvidia-smi/);
assert.match(runtime,/--query-gpu=name/);
assert.match(runtime,/"V100" not in gpu_name\.upper\(\)/);
assert.match(runtime,/paddle\.device\.is_compiled_with_cuda\(\)/);
assert.match(runtime,/"gpu_name": gpu_name/);
assert.match(runtime,/"paddle_cuda": paddle_cuda/);
assert.match(router,/V100_RUNTIME_ATTESTATION_FAILED/);
assert.match(router,/\/v100\/i\.test\(String\(r\.gpu_name/);
assert.match(router,/r\.paddle_cuda!==true/);
assert.match(router,/"baidu_terminal_failed"/);

console.log(JSON.stringify({ok:true,suite:"provider-autonomy-contract",free_only:true,daily_control_plane:true,scheduled_gpu_canary:false,temporary_p24_acceptance_cron:true,route_requires_live_health:true,baidu_candidate:"paddle2.4_py3.7",baidu_p25_quarantined:true,baidu_p26_quarantined:true,automatic_candidate_execution:false,baidu_e2e_gate_preserved:true,baidu_terminal_fast_exit:true,baidu_runtime_v100_attestation:true,runtime_failure_passthrough:true}));
