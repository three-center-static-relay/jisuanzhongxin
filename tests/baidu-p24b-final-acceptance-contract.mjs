import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const oldWrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p24b-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const p24cWrapperUrl=new URL("../src/production-entry-baidu-p24c-sdk039-e2e.js",import.meta.url);
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});

assert.equal(meta.runtime_candidate,"paddle2.4_py3.7");
assert.equal(meta.runtime_candidate_state,"QUARANTINED");
assert.equal(meta.runtime_candidate_evidence.live_e2e_failures,3);
assert.equal(meta.runtime_candidate_evidence.latest_task_id,"baidu-circleci-live-20260817p24c-sdk039");
assert.equal(meta.runtime_candidate_evidence.latest_sdk_version,"0.3.9");
assert.equal(meta.runtime_candidate_evidence.latest_failure_class,"BAIDU_COMPUTE_CREDIT_INSUFFICIENT");
assert.equal(meta.runtime_candidate_evidence.latest_bridge_stage,"aistudio_submit_returned");
assert.equal(meta.runtime_candidate_evidence.baidu_job_id_confirmed,false);
assert.equal(meta.runtime_candidate_evidence.gpu_job_confirmed,false);
assert.equal(meta.runtime_candidate_evidence.result_digest_present,false);
assert.equal(meta.runtime_candidate_evidence.bridge_result_retrieved,false);
assert.equal(meta.runtime_candidate_evidence.v100_cuda_verified,false);
assert.equal(meta.runtime_candidate_evidence.production_promoted,false);
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.automation_ready,false);
assert.equal(meta.automatic_same_failure_retry,false);
assert.equal(meta.sdk_candidate_control_plane_verified,true);
assert.equal(meta.sdk_candidate_gpu_verified,false);
assert.equal(meta.candidate_retest_policy,"blocked-until-free-coupon-credit-available-and-manual-acceptance");

// Preserve the prior P24b evidence as historical evidence, not as current production state.
assert.match(oldWrapper,/TASK_ID="baidu-circleci-live-20260816p24b"/);
assert.match(oldWrapper,/RUNTIME="paddle2\.4_py3\.7"/);
assert.match(oldWrapper,/production_promoted:false/);
assert.doesNotMatch(oldWrapper,/retry\s*\(/);

assert.match(admin,/from "\.\/production-entry\.js"/);
assert.doesNotMatch(admin,/production-entry-baidu-p24c-sdk039-e2e\.js/);
assert.equal(fs.existsSync(p24cWrapperUrl),false);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);
assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);

console.log(JSON.stringify({ok:true,suite:"baidu-p24b-final-acceptance-contract",historical_p24b_preserved:true,current_latest_task:"baidu-circleci-live-20260817p24c-sdk039",current_latest_failure:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT",live_e2e_failures:3,baidu_job_id_confirmed:false,v100_cuda_verified:false,production_runtime:null,route_eligible:false,automatic_retry:false,p24c_wrapper_removed:true}));
