import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const start=admin.indexOf("async function runP24ReadOnlyCheck");
const end=admin.indexOf("async function p24Diagnostic",start);
const diagnosticDispatch=admin.slice(start,end);

assert.ok(start>=0&&end>start);
assert.match(admin,/P24_SOURCE_TASK_ID="baidu-circleci-live-20260816p24a"/);
assert.match(admin,/P24_DIAG_TASK_ID="baidu-circleci-diag-20260816p24a-1"/);
assert.match(admin,/P24_DIAG_EXPIRES_AT/);
assert.match(diagnosticDispatch,/triggerBaiduBridge\(env,\{op:"CHECK"/);
assert.doesNotMatch(diagnosticDispatch,/op:"SUBMIT"/);
assert.doesNotMatch(diagnosticDispatch,/--device|--gpus|--payment|coupon|acoin/i);
assert.match(diagnosticDispatch,/read_only_diagnostic:true/);
assert.match(admin,/gpu_submit:false/);
assert.match(admin,/source_job_id_exposed:false/);
assert.match(admin,/result_body_exposed:false/);
assert.doesNotMatch(admin,/baidu_job_id:task\.baidu_job_id/);
assert.match(wrangler,/"17 4 \* \* \*"/);
assert.match(wrangler,/"\* \* \* \* \*"/);
const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.automation_ready,false);
console.log(JSON.stringify({ok:true,suite:"baidu-p24-readonly-check-contract",operation:"CHECK",submit:false,gpu_submit:false,one_shot:true,time_bounded:true,production_gate_preserved:true}));
