import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p24b-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const sdkWrapperUrl=new URL("../src/production-entry-baidu-sdk039-selftest.js",import.meta.url);
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});
assert.equal(meta.runtime_candidate,"paddle2.4_py3.7");
assert.equal(meta.runtime_candidate_state,"QUARANTINED");
assert.equal(meta.runtime_candidate_evidence.live_e2e_failures,2);
assert.equal(meta.runtime_candidate_evidence.latest_failure_class,"BAIDU_JOB_TERMINAL_FAILED");
assert.equal(meta.runtime_candidate_evidence.latest_bootstrap_reason,"BOOTSTRAP_NOT_AVAILABLE");
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.automation_ready,false);
assert.equal(meta.automatic_same_failure_retry,false);
assert.equal(meta.sdk_candidate_control_plane_verified,true);
assert.equal(meta.sdk_candidate_control_plane_evidence.task_id,"baidu-sdk039-control-plane-20260816c");
assert.equal(meta.sdk_candidate_gpu_verified,false);
assert.equal(meta.candidate_retest_policy,"single-sdk039-p24-canary-allowed-after-control-plane-pass");
assert.ok(meta.runtime_quarantined.includes("paddle2.4_py3.7"));

assert.match(wrapper,/TASK_ID="baidu-circleci-live-20260816p24b"/);
assert.match(wrapper,/RUNTIME="paddle2\.4_py3\.7"/);
assert.match(wrapper,/u\.hostname!=="compute\.internal"/);
assert.match(wrapper,/matrix_size:256,rounds:1,seed:20260816/);
assert.match(wrapper,/one_shot:true/);
assert.match(wrapper,/production_promoted:false/);
assert.match(wrapper,/runtime_production!==null/);
assert.doesNotMatch(wrapper,/retry\s*\(/);
assert.match(wrapper,/ACCEPTANCE_EXPIRES_AT=Date\.parse\("2026-08-16T12:30:00Z"\)/);
assert.match(wrapper,/baidu_job_id_present:Boolean/);
assert.doesNotMatch(wrapper,/baidu_job_id:t\.baidu_job_id/);

assert.match(admin,/from "\.\/production-entry\.js"/);
assert.doesNotMatch(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.equal(fs.existsSync(sdkWrapperUrl),false);
assert.doesNotMatch(admin,/SELFTEST_PATH/);
assert.doesNotMatch(admin,/production-entry-baidu-p24b-e2e\.js/);
assert.doesNotMatch(admin,/P24B_TRIGGER_CRON/);
assert.doesNotMatch(admin,/P24B_ACCEPTANCE_PATH/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);

assert.match(bridge,/BOOTSTRAP_SCHEMA = "baidu-bootstrap-sentinel-v1"/);
assert.match(bridge,/BOOTSTRAP_COMMAND = "sh \/home\/aistudio\/bootstrap\.sh"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);

console.log(JSON.stringify({ok:true,suite:"baidu-p24b-final-acceptance-contract",runtime:"paddle2.4_py3.7",p24b_result:"failed",failure_class:"BAIDU_JOB_TERMINAL_FAILED",bootstrap_reason:"BOOTSTRAP_NOT_AVAILABLE",candidate_state:"QUARANTINED",live_e2e_failures:2,sdk039_control_plane_verified:true,sdk039_gpu_verified:false,production_runtime:null,route_eligible:false,automatic_retry:false,p24b_trigger_removed:true,temporary_sdk039_wrapper_removed:true,one_controlled_p24_sdk039_canary_allowed:true,minute_cron:false}));
