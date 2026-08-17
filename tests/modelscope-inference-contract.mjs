import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const inference=fs.readFileSync(new URL("../src/modelscope-inference.js",import.meta.url),"utf8");
assert.match(entry,/\/v1\/selftest\/modelscope-inference/);
assert.match(entry,/secrets_redacted:true/);
assert.match(inference,/https:\/\/api-inference\.modelscope\.cn\/v1\/chat\/completions/);
assert.match(inference,/Qwen\/Qwen3-32B/);
assert.match(inference,/17\*19/);
assert.match(inference,/\b323\b/);
assert.match(inference,/max_tokens:32/);
assert.match(inference,/paid_fallback:false/);
assert.match(inference,/free_only:true/);
assert.doesNotMatch(entry,/authorization:`Bearer/);
console.log(JSON.stringify({ok:true,suite:"modelscope-inference-contract",bounded:true,expected:"323",free_only:true,paid_fallback:false,secrets_redacted:true}));
