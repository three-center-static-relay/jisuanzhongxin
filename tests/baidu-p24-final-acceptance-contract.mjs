import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta} from "../src/baidu-circleci.js";

const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p24-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../bridge/baidu/job/run.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

const meta=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});
assert.equal(meta.runtime_candidate,"paddle2.4_py3.7");
assert.equal(meta.runtime_production,null);
assert.equal(meta.route_eligible,false);
assert.equal(meta.automation_ready,false);
assert.equal(meta.acceptance_flag_present,true);

assert.match(wrapper,/const TASK_ID="baidu-circleci-live-20260816p24a"/);
assert.match(wrapper,/const RUNTIME="paddle2\.4_py3\.7"/);
assert.match(wrapper,/u\.hostname!=="compute\.internal"/);
assert.match(wrapper,/matrix_size:256,rounds:1,seed:20260816/);
assert.match(wrapper,/one_shot:true/);
assert.match(wrapper,/production_promoted:false/);
assert.doesNotMatch(wrapper,/retry\(/);
assert.match(wrapper,/runtime_production!==null/);

assert.match(admin,/production-entry-baidu-p24-e2e\.js/);
assert.match(admin,/P24_TRIGGER_CRON="\* \* \* \* \*"/);
assert.match(admin,/P24_ACCEPTANCE_PATH=/);
assert.match(admin,/compute\.internal/);
assert.match(wrangler,/"17 4 \* \* \*"/);
assert.match(wrangler,/"\* \* \* \* \*"/);

assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/--payment.*acoin/);
assert.match(runtime,/nvidia-smi/);
assert.match(runtime,/paddle\.device\.is_compiled_with_cuda\(\)/);
assert.match(runtime,/"V100" not in gpu_name\.upper\(\)/);

console.log(JSON.stringify({ok:true,suite:"baidu-p24-final-acceptance-contract",runtime:"paddle2.4_py3.7",device:"v100",gpus:1,payment:"coupon",one_shot:true,production_gate:true,automatic_retry:false}));
