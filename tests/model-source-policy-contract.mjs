import assert from "node:assert/strict";
import fs from "node:fs";

const baidu=fs.readFileSync(new URL("../src/baidu-llm.js",import.meta.url),"utf8");
const modelscope=fs.readFileSync(new URL("../src/modelscope-inference.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
for(const text of [baidu,modelscope]){
  assert.match(text,/MODEL_SOURCE_NOT_APPROVED/);
  assert.match(text,/workers-ai/);
  assert.match(text,/openrouter/);
  assert.match(text,/huggingface/);
  assert.doesNotMatch(text,/api\.deepseek\.com|api-inference\.modelscope\.cn|aistudio\.baidu\.com\/llm/i);
  assert.doesNotMatch(text,/DEEPSEEK_API_KEY|MODELSCOPE_API_TOKEN|BAIDU_AISTUDIO_ACCESS_TOKEN/);
}
assert.match(wrangler,/"MODEL_SOURCE_CLASSES":"workers-ai,openrouter,huggingface"/);
assert.match(wrangler,/"MODEL_SOURCE_POLICY":"three-source-cloudflare-free-first"/);
console.log(JSON.stringify({ok:true,suite:"compute-model-source-policy-contract",approved_sources:["workers-ai","openrouter","huggingface"],retired_direct_inference_sources:["baidu-aistudio-llm","modelscope-inference"],compute_backends_unchanged:true}));
