import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const inference=fs.readFileSync(new URL("../src/modelscope-inference.js",import.meta.url),"utf8");
assert.match(entry,/\/v1\/selftest\/modelscope-inference/);
assert.match(entry,/secrets_redacted:true/);
assert.match(inference,/https:\/\/api-inference\.modelscope\.cn\/v1\/chat\/completions/);
assert.match(inference,/Qwen\/Qwen2\.5-Coder-32B-Instruct/);
assert.match(inference,/17\*19/);
assert.match(inference,/\b323\b/);
assert.match(inference,/max_tokens:64/);
assert.doesNotMatch(inference,/enable_thinking/);
assert.match(inference,/paid_fallback:false/);
assert.match(inference,/free_only:true/);
assert.doesNotMatch(entry,/authorization:`Bearer/);
console.log(JSON.stringify({ok:true,suite:"modelscope-inference-contract",bounded:true,expected:"323",model:"Qwen/Qwen2.5-Coder-32B-Instruct",free_only:true,paid_fallback:false,secrets_redacted:true}));
