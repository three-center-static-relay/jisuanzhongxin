import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p24c-sdk039-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const baidu=fs.readFileSync(new URL("../src/baidu-circleci.js",import.meta.url),"utf8");
const router=fs.readFileSync(new URL("../src/baidu-circleci-router.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def"});

assert.equal(meta.production_runtime,undefined);
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.runtime_candidate,"paddle2.4_py3.7");
assert.equal(meta.runtime_candidate_state,"QUARANTINED");
assert.equal(meta.sdk_pinned,"aistudio-sdk==0.3.8");
assert.equal(meta.sdk_upgrade_candidate,"aistudio-sdk==0.3.9");
assert.equal(meta.sdk_candidate_control_plane_verified,true);
assert.equal(meta.sdk_candidate_gpu_verified,false);
assert.equal(meta.sdk_candidate_acceptance_task,"baidu-circleci-live-20260817p24c-sdk039");
assert.equal(meta.candidate_retest_policy,"single-sdk039-p24-canary-allowed-after-control-plane-pass");
assert.equal(meta.automatic_candidate_execution,false);
assert.equal(meta.automatic_same_failure_retry,false);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.acoin_allowed,false);

assert.match(wrapper,/TASK_ID="baidu-circleci-live-20260817p24c-sdk039"/);
assert.match(wrapper,/RUNTIME="paddle2\.4_py3\.7"/);
assert.match(wrapper,/SDK_VERSION="0\.3\.9"/);
assert.match(wrapper,/ACCEPTANCE_PATH="\/__acceptance\/baidu-v100-p24c-sdk039-20260817-[a-f0-9]{64}"/);
assert.match(wrapper,/STATUS_PATH="\/__diagnostic\/baidu-v100-p24c-sdk039-result-20260817-[a-f0-9]{64}"/);
assert.match(wrapper,/matrix_size:256,rounds:1,seed:20260817/);
assert.match(wrapper,/timeout_seconds:300/);
assert.match(wrapper,/candidate_sdk_acceptance:true/);
assert.match(wrapper,/device:"v100"/);
assert.match(wrapper,/gpus:1/);
assert.match(wrapper,/payment:"coupon"/);
assert.match(wrapper,/one_shot:true/);
assert.match(wrapper,/automatic_retry:false/);
assert.match(wrapper,/production_promoted:false/);
assert.match(wrapper,/sdk_candidate_control_plane_verified===true/);
assert.match(wrapper,/sdk_candidate_gpu_verified===false/);
assert.match(wrapper,/single-sdk039-p24-canary-allowed-after-control-plane-pass/);
assert.doesNotMatch(wrapper,/retry\s*\(/);
assert.doesNotMatch(wrapper,/acoin/i);

assert.match(baidu,/SDK039_ACCEPTANCE_TASK="baidu-circleci-live-20260817p24c-sdk039"/);
assert.match(baidu,/candidate_sdk_acceptance=false/);
assert.match(baidu,/candidateAcceptance&&\(operation!=="SUBMIT"\|\|id!==SDK039_ACCEPTANCE_TASK\)/);
assert.match(baidu,/operation==="SDK_SELFTEST"\|\|candidateAcceptance\?"0\.3\.9":"0\.3\.8"/);
assert.match(router,/V100_RUNTIME_ATTESTATION_FAILED/);
assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);

assert.match(admin,/production-entry-baidu-p24c-sdk039-e2e\.js/);
assert.doesNotMatch(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.doesNotMatch(admin,/"\* \* \* \* \*"/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);

console.log(JSON.stringify({ok:true,suite:"baidu-p24c-sdk039-acceptance-contract",task_id:"baidu-circleci-live-20260817p24c-sdk039",runtime:"paddle2.4_py3.7",sdk_version:"0.3.9",v100:1,payment:"coupon",one_shot:true,automatic_retry:false,automatic_promotion:false,normal_submit_sdk:"0.3.8",production_runtime:null,route_eligible:false}));
