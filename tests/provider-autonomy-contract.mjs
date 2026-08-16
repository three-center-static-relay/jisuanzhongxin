import assert from "node:assert/strict";
import fs from "node:fs";
import {AUTONOMY_POLICY,BAIDU_RUNTIME_POLICY} from "../src/provider-autonomy.js";

const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const autonomy=read("../src/provider-autonomy.js");
const admin=read("../src/admin-entry.js");
const baidu=read("../src/baidu-circleci.js");
const router=read("../src/baidu-circleci-router.js");
const bridge=read("../bridge/baidu/bridge_entry9.py");
const runtime=read("../bridge/baidu/job/run.py");
const wrangler=read("../wrangler.jsonc");

for(const state of ["VERIFIED","DEGRADED","QUARANTINED","CANDIDATE","DISABLED"])assert.match(autonomy,new RegExp(`"${state}"`));
assert.equal(AUTONOMY_POLICY.free_only,true);
assert.equal(AUTONOMY_POLICY.paid_fallback,false);
assert.equal(AUTONOMY_POLICY.scheduled_gpu_canary,false);
assert.equal(AUTONOMY_POLICY.quarantine_after_consecutive_failures,2);
assert.equal(AUTONOMY_POLICY.recover_after_consecutive_successes,2);
assert.equal(AUTONOMY_POLICY.user_routine_maintenance_required,false);
assert.equal(AUTONOMY_POLICY.route_requires_live_health,true);

assert.equal(BAIDU_RUNTIME_POLICY.production_runtime,null);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_runtime,"paddle2.4_py3.7");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_state,"QUARANTINED");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.live_e2e_failures,2);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_failure_class,"BAIDU_JOB_TERMINAL_FAILED");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_bootstrap_reason,"BOOTSTRAP_NOT_AVAILABLE");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.result_digest_present,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.bridge_result_retrieved,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.v100_cuda_verified,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.production_promoted,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.diagnostic_root_cause_available,false);
assert.equal(BAIDU_RUNTIME_POLICY.diagnostic_surface,"pipeline-query-stage-plus-bootstrap-sentinel");
assert.deepEqual(BAIDU_RUNTIME_POLICY.public_callable_log_detail_info,{"0.3.8":false,"0.3.9":false});
assert.equal(BAIDU_RUNTIME_POLICY.sdk_upgrade_for_diagnostics,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_retest_policy,"blocked-until-upstream-runtime-change");
assert.equal(BAIDU_RUNTIME_POLICY.automatic_candidate_execution,false);
assert.equal(BAIDU_RUNTIME_POLICY.automatic_same_failure_retry,false);
assert.deepEqual(BAIDU_RUNTIME_POLICY.quarantined_runtimes,["paddle2.4_py3.7","paddle2.6_py3.10","paddle2.5_py3.10"]);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.4_py3.7"].live_e2e_failures,2);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.4_py3.7"].latest_bootstrap_reason,"BOOTSTRAP_NOT_AVAILABLE");
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.5_py3.10"].live_e2e_failures,2);

assert.match(admin,/async scheduled\(controller,env,ctx\)/);
assert.match(admin,/runAutonomySweep\(app,env,ctx\)/);
assert.match(admin,/from "\.\/production-entry\.js"/);
assert.doesNotMatch(admin,/P24B_TRIGGER_CRON/);
assert.doesNotMatch(admin,/production-entry-baidu-p24b-e2e\.js/);
assert.doesNotMatch(admin,/P25B_TRIGGER_CRON/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.match(wrangler,/baidu-p24b-final-acceptance-contract\.mjs/);
assert.doesNotMatch(wrangler,/baidu-p25b-canary-contract\.mjs/);

assert.match(autonomy,/health\?\.route_eligible===true/);
assert.match(autonomy,/meta\?\.historically_verified===true/);
assert.match(autonomy,/route_eligible:routeEligible/);

for(const pattern of [/baidu_payment:"coupon"/,/free_only:true/,/paid_fallback:false/,/acoin_allowed:false/,/sdk_pinned:"aistudio-sdk==0\.3\.8"/,/runtime_candidate:"paddle2\.4_py3\.7"/,/runtime_candidate_state:"QUARANTINED"/,/live_e2e_failures:2/,/latest_bootstrap_reason:"BOOTSTRAP_NOT_AVAILABLE"/,/automatic_candidate_execution:false/,/automatic_same_failure_retry:false/,/candidate_retest_policy:"blocked-until-upstream-runtime-change"/,/route_eligible:configured&&e2eVerified/])assert.match(baidu,pattern);
assert.doesNotMatch(baidu,/acoin_allowed:true/);

assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/BOOTSTRAP_SCHEMA = "baidu-bootstrap-sentinel-v1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);
assert.match(bridge,/STATUS_PROBE_EVERY_POLLS = 2/);
assert.match(bridge,/check_impl\._query_pipeline\(token, job_id\)/);
assert.match(bridge,/BAIDU_JOB_TERMINAL_FAILED/);
assert.match(bridge,/upstream_diagnostic/);
assert.match(bridge,/_runtime_failure_class\(result\)/);

assert.match(runtime,/nvidia-smi/);
assert.match(runtime,/"V100" not in gpu_name\.upper\(\)/);
assert.match(runtime,/paddle\.device\.is_compiled_with_cuda\(\)/);
assert.match(runtime,/"gpu_name": gpu_name/);
assert.match(runtime,/"paddle_cuda": paddle_cuda/);
assert.match(router,/V100_RUNTIME_ATTESTATION_FAILED/);
assert.match(router,/safeUpstreamDiagnostic/);

console.log(JSON.stringify({ok:true,suite:"provider-autonomy-contract",free_only:true,daily_control_plane:true,scheduled_gpu_canary:false,p24b_trigger_removed:true,route_requires_live_health:true,baidu_last_candidate:"paddle2.4_py3.7",baidu_candidate_state:"QUARANTINED",live_e2e_failures:2,automatic_candidate_execution:false,automatic_same_failure_retry:false,production_runtime:null,bootstrap_reason:"BOOTSTRAP_NOT_AVAILABLE"}));
