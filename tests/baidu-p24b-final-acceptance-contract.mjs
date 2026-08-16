import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p24b-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});
assert.equal(meta.runtime_candidate,"paddle2.4_py3.7");
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.automation_ready,false);
assert.equal(meta.automatic_same_failure_retry,false);
assert.equal(meta.candidate_retest_policy,"manual-single-retest-only");

assert.match(wrapper,/TASK_ID="baidu-circleci-live-20260816p24b"/);
assert.match(wrapper,/RUNTIME="paddle2\.4_py3\.7"/);
assert.match(wrapper,/u\.hostname!=="compute\.internal"/);
assert.match(wrapper,/matrix_size:256,rounds:1,seed:20260816/);
assert.match(wrapper,/one_shot:true/);
assert.match(wrapper,/production_promoted:false/);
assert.match(wrapper,/runtime_production!==null/);
assert.doesNotMatch(wrapper,/retry\s*\(/);
assert.match(wrapper,/STATUS_PATH="\/__diagnostic\/baidu-v100-p24b-result-20260816-/);
assert.match(wrapper,/ACCEPTANCE_EXPIRES_AT=Date\.parse\("2026-08-16T12:30:00Z"\)/);
assert.match(wrapper,/DIAGNOSTIC_EXPIRES_AT=Date\.parse\("2026-08-16T13:30:00Z"\)/);
assert.match(wrapper,/Date\.now\(\)>DIAGNOSTIC_EXPIRES_AT/);
assert.match(wrapper,/Date\.now\(\)>ACCEPTANCE_EXPIRES_AT/);
assert.match(wrapper,/baidu_job_id_present:Boolean/);
assert.doesNotMatch(wrapper,/baidu_job_id:t\.baidu_job_id/);

assert.match(admin,/production-entry-baidu-p24b-e2e\.js/);
assert.match(admin,/P24B_TRIGGER_CRON="\* \* \* \* \*"/);
assert.match(admin,/P24B_ACCEPTANCE_PATH=/);
assert.match(wrangler,/"17 4 \* \* \*"/);
assert.match(wrangler,/"\* \* \* \* \*"/);

assert.match(bridge,/BOOTSTRAP_SCHEMA = "baidu-bootstrap-sentinel-v1"/);
assert.match(bridge,/BOOTSTRAP_COMMAND = "sh \/home\/aistudio\/bootstrap\.sh"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);

console.log(JSON.stringify({ok:true,suite:"baidu-p24b-final-acceptance-contract",runtime:"paddle2.4_py3.7",device:"v100",gpus:1,payment:"coupon",one_shot:true,bootstrap_sentinel:true,production_gate:true,automatic_retry:false,acceptance_trigger_expired:true,diagnostic_status_window:true}));
