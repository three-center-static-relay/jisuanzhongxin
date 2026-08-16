import assert from "node:assert/strict";
import fs from "node:fs";

const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry25.py",import.meta.url),"utf8");
const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p25-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const circle=fs.readFileSync(new URL("../.circleci/config.yml",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

assert.match(bridge,/RUNTIME = "paddle2\.5_py3\.10"/);
assert.match(bridge,/START_COMMAND = "sh run\.sh"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);
assert.match(bridge,/nvidia-smi/);
assert.match(bridge,/paddle\.device\.is_compiled_with_cuda/);
assert.match(bridge,/paddle\.set_device\("gpu:0"\)/);
assert.match(bridge,/cuda_kernel_value/);
assert.match(bridge,/\/home\/aistudio\/output\/three-center-result\.json/);
assert.match(wrapper,/const TASK_ID="baidu-circleci-live-20260816p25"/);
assert.match(wrapper,/const RUNTIME="paddle2\.5_py3\.10"/);
assert.match(wrapper,/const DIAGNOSTIC="paddle25-v100-e2e"/);
assert.match(wrapper,/one_shot:true/);
assert.doesNotMatch(wrapper,/retry\(/);
assert.doesNotMatch(wrapper,/RETRY_PATH/);
assert.match(admin,/production-entry-baidu-p25-e2e\.js/);
assert.match(admin,/P25_TRIGGER_CRON="\* \* \* \* \*"/);
assert.match(admin,/P25_ACCEPTANCE_PATH/);
assert.match(admin,/app\.fetch\(new Request\(`\$\{ORIGIN\}\$\{P25_ACCEPTANCE_PATH\}`/);
assert.match(wrangler,/"\* \* \* \* \*"/);
assert.match(circle,/bridge_entry25\.py --selftest-p25/);
assert.match(circle,/command: python bridge\/baidu\/bridge_entry25\.py/);

console.log(JSON.stringify({ok:true,suite:"baidu-p25-canary-contract",runtime:"paddle2.5_py3.10",one_shot:true,payment:"coupon",v100:true,paddle_cuda_probe:true,temporary_cloudflare_trigger:true}));
