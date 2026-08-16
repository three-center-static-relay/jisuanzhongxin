import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

// Direct trigger is temporary, high entropy, time bounded, and SDK-control-plane-only.
const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-sdk039-selftest.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const config=fs.readFileSync(new URL("../.circleci/config.yml",import.meta.url),"utf8");
const probe=fs.readFileSync(new URL("../bridge/baidu/sdk_selftest.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def"});

assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.sdk_pinned,"aistudio-sdk==0.3.8");
assert.equal(meta.sdk_upgrade_candidate,"aistudio-sdk==0.3.9");
assert.equal(meta.sdk_candidate_probe,"circleci-control-plane-only");
assert.equal(meta.sdk_candidate_gpu_submission,false);
assert.ok(meta.allowed_operations.includes("SDK_SELFTEST"));

assert.match(wrapper,/TASK_ID="baidu-sdk039-control-plane-20260816b"/);
assert.match(wrapper,/SDK_VERSION="0\.3\.9"/);
assert.match(wrapper,/SELFTEST_PATH="\/__selftest\/baidu-sdk039-control-/);
assert.match(wrapper,/DIRECT_TRIGGER_PATH="\/__selftest\/baidu-sdk039-direct-20260816-[a-f0-9]{64}"/);
assert.match(wrapper,/STATUS_PATH="\/__diagnostic\/baidu-sdk039-control-result-/);
assert.match(wrapper,/u\.hostname!=="compute\.internal"/);
assert.match(wrapper,/u\.pathname===DIRECT_TRIGGER_PATH/);
assert.match(wrapper,/op:"SDK_SELFTEST"/);
assert.match(wrapper,/gpu:false/);
assert.match(wrapper,/compute_credit_used:false/);
assert.match(wrapper,/\/pipeline\/\$\{encodeURIComponent\(pipelineId\)\}\/workflow/);
assert.match(wrapper,/circleci_workflow_status/);
assert.match(wrapper,/SELFTEST_EXPIRES_AT/);
assert.match(wrapper,/DIAGNOSTIC_EXPIRES_AT/);
assert.doesNotMatch(wrapper,/op:"SUBMIT"/);
assert.doesNotMatch(wrapper,/matrix_size/);
assert.doesNotMatch(wrapper,/device:"v100"/);
assert.doesNotMatch(wrapper,/payment:"coupon"/);

assert.match(config,/sdk_version:/);
assert.match(config,/default: "0\.3\.8"/);
assert.match(config,/SDK_SELFTEST/);
assert.match(config,/sdk_selftest\.py/);
const legacyGuards=[...config.matchAll(/!= "SDK_SELFTEST"/g)].length;
assert.equal(legacyGuards,5);
assert.match(config,/if \[ "<< pipeline\.parameters\.bridge_op >>" = "SDK_SELFTEST" \]; then\s+python bridge\/baidu\/sdk_selftest\.py\s+else\s+python bridge\/baidu\/bridge_entry9\.py/s);
assert.match(config,/python bridge\/baidu\/bridge\.py --selftest-parser/);
assert.match(config,/python bridge\/baidu\/bridge_entry2\.py --selftest-parser/);
assert.match(config,/python bridge\/baidu\/bridge_entry4\.py --selftest-diagnostic/);
assert.match(config,/python bridge\/baidu\/job\/run\.py --selftest/);
assert.match(config,/python bridge\/baidu\/bridge_entry9\.py --selftest-startup/);
assert.match(probe,/EXPECTED_VERSION = "0\.3\.9"/);
assert.match(probe,/pipeline_query_ok/);
assert.match(probe,/bosacl_ls_cp/);
assert.match(probe,/"gpu_submitted": False/);
assert.match(probe,/"compute_credit_used": False/);
assert.doesNotMatch(probe,/aistudio\s+submit\s+job/i);

assert.match(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.doesNotMatch(admin,/SELFTEST_PATH/);
assert.doesNotMatch(admin,/"\* \* \* \* \*"/);
assert.match(admin,/runAutonomySweep\(app,env,ctx\)/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);

console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-selftest-contract",sdk_candidate:"0.3.9",control_plane_only:true,legacy_bridge_selftests_skipped_only_for_sdk_selftest:true,normal_bridge_regression_preserved:true,gpu_submitted:false,compute_credit_used:false,production_runtime:null,route_eligible:false,one_shot:true,high_entropy_direct_trigger:true,minute_cron:false}));
