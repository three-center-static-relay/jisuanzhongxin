import assert from "node:assert/strict";
import fs from "node:fs";

const studio=fs.readFileSync(new URL("../src/modelscope-studio.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

assert.match(studio,/three-center-cpu-runner/);
assert.match(studio,/MIN_CPU=8/);
assert.match(studio,/MIN_MEMORY_GB=30/);
assert.match(studio,/platform\//);
assert.match(studio,/paid\//);
assert.match(studio,/paid_fallback:false/);
assert.match(studio,/visibility:\"private\"/);
assert.match(studio,/repos\/studios/);
assert.match(studio,/commit\/master/);
assert.match(studio,/THREE_CENTER_MODELSCOPE_CPU_RUNTIME/);
assert.match(studio,/square_sum_correct/);
assert.match(studio,/\/studios\/\$\{urlOwner\(owner\)\}\/\$\{urlRepo\(REPO_NAME\)\}\/stop/);
assert.match(entry,/\/v1\/selftest\/modelscope-studio/);
assert.match(entry,/\/v1\/admin\/modelscope\/studio-bootstrap/);
assert.match(entry,/url\.hostname!==\"compute\.internal\"/);
assert.match(entry,/STUDIO_BOOTSTRAP_CRON=\"\*\/5 \* \* \* \*\"/);
assert.match(wrangler,/\*\/5 \* \* \* \*/);
assert.doesNotMatch(entry,/req\.method===\"POST\"&&url\.pathname===\"\/v1\/selftest\/modelscope-studio/);
console.log(JSON.stringify({ok:true,suite:"modelscope-studio-cpu-runner-contract",min_cpu:8,min_memory_gb:30,free_only:true,paid_fallback:false,private_studio:true,public_write_endpoint:false,temporary_cron:true}));
