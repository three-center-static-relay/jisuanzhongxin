import assert from "node:assert/strict";
import fs from "node:fs";

const wrapper=fs.readFileSync(new URL("../src/production-entry-baidu-p25b-e2e.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../bridge/baidu/job/run.py",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

assert.match(wrapper,/const TASK_ID="baidu-circleci-live-20260816p25b"/);
assert.match(wrapper,/const RUNTIME="paddle2\.5_py3\.10"/);
assert.match(wrapper,/matrix_size:256,rounds:1,seed:20260816/);
assert.match(wrapper,/one_shot:true/);
assert.doesNotMatch(wrapper,/retry\(/);
assert.match(admin,/production-entry-baidu-p25b-e2e\.js/);
assert.match(admin,/P25B_TRIGGER_CRON="\* \* \* \* \*"/);
assert.match(wrangler,/"\* \* \* \* \*"/);
assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.5_py3\.10"/);
assert.match(bridge,/"--device", "v100"/);
assert.match(bridge,/"--gpus", "1"/);
assert.match(bridge,/"--payment", "coupon"/);
assert.match(bridge,/BAIDU_JOB_TERMINAL_FAILED/);
assert.match(runtime,/nvidia-smi/);
assert.match(runtime,/"V100" not in gpu_name\.upper\(\)/);
assert.match(runtime,/paddle\.device\.is_compiled_with_cuda\(\)/);
assert.match(runtime,/"gpu_name": gpu_name/);
assert.match(runtime,/"paddle_cuda": paddle_cuda/);

console.log(JSON.stringify({ok:true,suite:"baidu-p25b-one-shot-contract",task_id:"baidu-circleci-live-20260816p25b",runtime:"paddle2.5_py3.10",device:"v100",gpus:1,payment:"coupon",one_shot:true,actual_gpu_name_attestation:true,paddle_cuda_attestation:true}));
