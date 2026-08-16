import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

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

assert.match(wrapper,/SDK_VERSION="0\.3\.9"/);
assert.match(wrapper,/SELFTEST_PATH="\/__selftest\/baidu-sdk039-control-/);
assert.match(wrapper,/STATUS_PATH="\/__diagnostic\/baidu-sdk039-control-result-/);
assert.match(wrapper,/u\.hostname!=="compute\.internal"/);
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
assert.match(probe,/EXPECTED_VERSION = "0\.3\.9"/);
assert.match(probe,/pipeline_query_ok/);
assert.match(probe,/bosacl_ls_cp/);
assert.match(probe,/"gpu_submitted": False/);
assert.match(probe,/"compute_credit_used": False/);
assert.doesNotMatch(probe,/aistudio\s+submit\s+job/i);

assert.match(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.match(admin,/SELFTEST_PATH/);
assert.match(admin,/"\* \* \* \* \*"/);
assert.match(wrangler,/"17 4 \* \* \*"/);
assert.match(wrangler,/"\* \* \* \* \*"/);

console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-selftest-contract",sdk_candidate:"0.3.9",control_plane_only:true,gpu_submitted:false,compute_credit_used:false,production_runtime:null,route_eligible:false,one_shot:true}));
