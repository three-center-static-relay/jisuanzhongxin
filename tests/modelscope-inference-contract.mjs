import assert from "node:assert/strict";
import fs from "node:fs";
import {modelScopeInferenceCanary} from "../src/modelscope-inference.js";

const inference=fs.readFileSync(new URL("../src/modelscope-inference.js",import.meta.url),"utf8");
assert.doesNotMatch(inference,/api-inference\.modelscope\.cn/);
assert.doesNotMatch(inference,/Qwen\/Qwen/);
assert.doesNotMatch(inference,/MODELSCOPE_API_TOKEN|MODELSCOPE_TOKEN/);
const receipt=await modelScopeInferenceCanary({});
assert.equal(receipt.ok,false);
assert.equal(receipt.error_class,"MODEL_SOURCE_NOT_APPROVED");
assert.equal(receipt.inference_ok,false);
assert.deepEqual(receipt.approved_sources,["workers-ai","openrouter","huggingface"]);
console.log(JSON.stringify({ok:true,suite:"modelscope-inference-retirement-contract",retired:true,approved_sources:receipt.approved_sources,secrets_redacted:true}));
