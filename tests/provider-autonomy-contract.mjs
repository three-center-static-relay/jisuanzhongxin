import assert from "node:assert/strict";
import fs from "node:fs";
import {AUTONOMY_POLICY,BAIDU_RUNTIME_POLICY} from "../src/provider-autonomy.js";

const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const admin=read("../src/admin-entry.js");
const baidu=read("../src/baidu-circleci.js");
const bridge=read("../bridge/baidu/bridge_entry9.py");
const runtime=read("../bridge/baidu/job/run.py");
const oldSdkWrapperUrl=new URL("../src/production-entry-baidu-sdk039-selftest.js",import.meta.url);
const p24cWrapperUrl=new URL("../src/production-entry-baidu-p24c-sdk039-e2e.js",import.meta.url);
const wrangler=read("../wrangler.jsonc");
const buildGate=JSON.parse(read("../package.json")).scripts?.["test:build-gate"]||"";

assert.equal(AUTONOMY_POLICY.free_only,true);
assert.equal(AUTONOMY_POLICY.paid_fallback,false);
assert.equal(AUTONOMY_POLICY.scheduled_gpu_canary,false);
assert.equal(AUTONOMY_POLICY.user_routine_maintenance_required,false);
assert.equal(AUTONOMY_POLICY.route_requires_live_health,true);

assert.equal(BAIDU_RUNTIME_POLICY.production_runtime,null);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_runtime,"paddle2.4_py3.7");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_state,"QUARANTINED");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.live_e2e_failures,3);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_task_id,"baidu-circleci-live-20260817p24c-sdk039");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_sdk_version,"0.3.9");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_failure_class,"BAIDU_COMPUTE_CREDIT_INSUFFICIENT");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.latest_bridge_stage,"aistudio_submit_returned");
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.circleci_pipeline_created,true);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.aistudio_auth_verified,true);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.aistudio_submit_returned,true);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.baidu_job_id_confirmed,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.gpu_job_confirmed,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.result_digest_present,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.bridge_result_retrieved,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.v100_cuda_verified,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_evidence.production_promoted,false);
assert.equal(BAIDU_RUNTIME_POLICY.sdk_candidate_control_plane_verified,true);
assert.equal(BAIDU_RUNTIME_POLICY.sdk_candidate_gpu_verified,false);
assert.equal(BAIDU_RUNTIME_POLICY.sdk_candidate_gpu_attempt_evidence.failure_class,"BAIDU_COMPUTE_CREDIT_INSUFFICIENT");
assert.equal(BAIDU_RUNTIME_POLICY.sdk_candidate_gpu_attempt_evidence.baidu_job_id_confirmed,false);
assert.equal(BAIDU_RUNTIME_POLICY.candidate_retest_policy,"blocked-until-free-coupon-credit-available-and-manual-acceptance");
assert.equal(BAIDU_RUNTIME_POLICY.automatic_candidate_execution,false);
assert.equal(BAIDU_RUNTIME_POLICY.automatic_same_failure_retry,false);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.4_py3.7"].live_e2e_failures,3);
assert.equal(BAIDU_RUNTIME_POLICY.quarantine_evidence["paddle2.4_py3.7"].latest_failure_class,"BAIDU_COMPUTE_CREDIT_INSUFFICIENT");

assert.match(admin,/from "\.\/production-entry\.js"/);
assert.doesNotMatch(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.doesNotMatch(admin,/production-entry-baidu-p24c-sdk039-e2e\.js/);
assert.equal(fs.existsSync(oldSdkWrapperUrl),false);
assert.equal(fs.existsSync(p24cWrapperUrl),false);
assert.doesNotMatch(admin,/"\* \* \* \* \*"/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);
assert.match(buildGate,/baidu-p24c-sdk039-acceptance-contract\.mjs/);

assert.match(baidu,/baidu_payment:"coupon"/);
assert.match(baidu,/paid_fallback:false/);
assert.match(baidu,/acoin_allowed:false/);
assert.match(baidu,/sdk_pinned:"aistudio-sdk==0\.3\.8"/);
assert.match(baidu,/sdk_upgrade_candidate:"aistudio-sdk==0\.3\.9"/);
assert.match(baidu,/latest_failure_class:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT"/);
assert.match(baidu,/live_e2e_failures:3/);
assert.match(baidu,/candidate_retest_policy:"blocked-until-free-coupon-credit-available-and-manual-acceptance"/);
assert.match(baidu,/route_eligible:configured&&e2eVerified/);
assert.doesNotMatch(baidu,/candidate_sdk_acceptance/);
assert.doesNotMatch(baidu,/SDK039_ACCEPTANCE_TASK/);

assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);
assert.match(runtime,/nvidia-smi/);
assert.match(runtime,/paddle\.device\.is_compiled_with_cuda\(\)/);

console.log(JSON.stringify({ok:true,suite:"provider-autonomy-contract",free_only:true,scheduled_gpu_canary:false,baidu_candidate_state:"QUARANTINED",live_e2e_failures:3,latest_failure_class:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT",baidu_job_id_confirmed:false,v100_cuda_verified:false,production_runtime:null,route_eligible:false,automatic_candidate_execution:false,automatic_same_failure_retry:false,p24c_wrapper_removed:true,sdk039_candidate_submit_removed:true}));
