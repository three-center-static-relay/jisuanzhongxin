import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const wrangler=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const build=wrangler.match(/"build"\s*:\s*\{\s*"command"\s*:\s*"([^"]+)"/)?.[1]||"";
assert.ok(build,"build command must exist");
for(const required of [
  "tests/modelscope-provider.mjs",
  "tests/modelscope-runtime-alert-contract.mjs",
  "tests/modelscope-live-selftest-contract.mjs",
  "tests/modelscope-inference-contract.mjs",
  "tests/modelscope-studio-lite-cpu-runner-contract.mjs",
  "tests/modelscope-studio-workflow-contract.mjs"
])assert.ok(build.includes(required),`deploy gate must retain ModelScope contract/fail-closed coverage: ${required}`);
assert.equal(build.includes("tests/modelscope-studio-workflow-trigger-once.mjs"),false,"global deploy gate must not trigger a real external ModelScope Workflow instance");
const triggerTest=readFileSync(new URL("./modelscope-studio-workflow-trigger-once.mjs",import.meta.url),"utf8");
assert.match(triggerTest,/runtime_e2e_verified/);
assert.match(triggerTest,/paid_fallback[^\n]*false/);
assert.match(triggerTest,/platform\/2v-cpu-16g-mem/);
console.log(JSON.stringify({ok:true,suite:"modelscope-deploy-isolation-contract",deploy_gate_external_trigger:false,provider_contract_tests_retained:true,live_e2e_test_retained:true,provider_remains_fail_closed:true}));
