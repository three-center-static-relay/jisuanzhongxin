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

assert.match(wrapper,/TASK_ID="baidu-sdk039-control-plane-20260816c"/);
assert.match(wrapper,/SDK_VERSION="0\.3\.9"/);
assert.match(wrapper,/RESULT_SCHEMA="baidu-sdk039-selftest-result-v1"/);
assert.match(wrapper,/DIRECT_TRIGGER_PATH="\/__selftest\/baidu-sdk039-direct-c-20260816-[a-f0-9]{64}"/);
assert.match(wrapper,/STATUS_PATH="\/__diagnostic\/baidu-sdk039-control-result-c-20260816-[a-f0-9]{64}"/);
assert.match(wrapper,/CALLBACK_PATH="\/__callback\/baidu-sdk039-c-20260816-[a-f0-9]{64}"/);
assert.match(wrapper,/ticketAuthorized\(req,current\)/);
assert.match(wrapper,/terminalCallback\(req,env\)/);
assert.match(wrapper,/body\.gpu_submitted!==false\|\|body\.compute_credit_used!==false\|\|body\.secrets_emitted!==false/);
assert.match(wrapper,/terminal_callback_received:true/);
assert.match(wrapper,/sdk_selftest_passed:true/);
assert.match(wrapper,/op:"SDK_SELFTEST"/);
assert.match(wrapper,/gpu:false/);
assert.match(wrapper,/compute_credit_used:false/);
assert.match(wrapper,/SELFTEST_EXPIRES_AT/);
assert.match(wrapper,/DIAGNOSTIC_EXPIRES_AT/);
assert.doesNotMatch(wrapper,/op:"SUBMIT"/);
assert.doesNotMatch(wrapper,/matrix_size/);
assert.doesNotMatch(wrapper,/device:"v100"/);
assert.doesNotMatch(wrapper,/payment:"coupon"/);

assert.match(config,/sdk_version:/);
assert.match(config,/default: "0\.3\.8"/);
assert.match(config,/SDK_SELFTEST/);
const legacyGuards=[...config.matchAll(/!= "SDK_SELFTEST"/g)].length;
assert.equal(legacyGuards,5);
assert.match(config,/SDK_SELFTEST_CALLBACK_PATH="\/__callback\/baidu-sdk039-c-20260816-[a-f0-9]{64}" python bridge\/baidu\/sdk_selftest\.py/);
assert.match(config,/no_output_timeout: 2m/);
assert.match(config,/python bridge\/baidu\/bridge\.py --selftest-parser/);
assert.match(config,/python bridge\/baidu\/bridge_entry2\.py --selftest-parser/);
assert.match(config,/python bridge\/baidu\/bridge_entry4\.py --selftest-diagnostic/);
assert.match(config,/python bridge\/baidu\/job\/run\.py --selftest/);
assert.match(config,/python bridge\/baidu\/bridge_entry9\.py --selftest-startup/);

assert.match(probe,/EXPECTED_VERSION = "0\.3\.9"/);
assert.match(probe,/RESULT_SCHEMA = "baidu-sdk039-selftest-result-v1"/);
assert.match(probe,/QUERY_TIMEOUT_SECONDS = 25/);
assert.match(probe,/"--query-child"/);
assert.match(probe,/timeout=QUERY_TIMEOUT_SECONDS/);
assert.match(probe,/AISTUDIO_PIPELINE_QUERY_TIMEOUT/);
assert.match(probe,/SDK_SELFTEST_CALLBACK_PATH/);
assert.match(probe,/impl\.api\("POST", path, payload\)/);
assert.match(probe,/pipeline_query_ok/);
assert.match(probe,/bosacl_ls_cp/);
assert.match(probe,/"gpu_submitted": False/);
assert.match(probe,/"compute_credit_used": False/);
assert.match(probe,/"secrets_emitted": False/);
assert.doesNotMatch(probe,/aistudio\s+submit\s+job/i);

assert.match(admin,/production-entry-baidu-sdk039-selftest\.js/);
assert.doesNotMatch(admin,/"\* \* \* \* \*"/);
assert.match(admin,/runAutonomySweep\(app,env,ctx\)/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);

console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-selftest-contract",sdk_candidate:"0.3.9",bounded_query_seconds:25,terminal_callback:true,ephemeral_ticket_callback:true,control_plane_only:true,legacy_bridge_selftests_skipped_only_for_sdk_selftest:true,normal_bridge_regression_preserved:true,gpu_submitted:false,compute_credit_used:false,secrets_emitted:false,production_runtime:null,route_eligible:false,one_shot:true,minute_cron:false}));
