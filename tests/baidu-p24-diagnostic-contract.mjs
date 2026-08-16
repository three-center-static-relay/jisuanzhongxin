import assert from "node:assert/strict";
import fs from "node:fs";

const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
assert.match(admin,/P24_TASK_ID="baidu-circleci-live-20260816p24a"/);
assert.match(admin,/P24_DIAG_PATH="\/__diagnostic\/baidu-p24-result-20260816-/);
assert.match(admin,/P24_DIAG_EXPIRES_AT/);
assert.match(admin,/result_digest_present/);
assert.match(admin,/bridge_result_retrieved/);
assert.match(admin,/v100_visible/);
assert.match(admin,/paddle_cuda/);
assert.match(admin,/production_ready:productionReady/);
assert.match(admin,/secrets_redacted:true/);
assert.match(admin,/result_body_exposed:false/);
assert.doesNotMatch(admin,/result:t\.result/);
assert.doesNotMatch(admin,/manifest:t\.manifest/);
assert.doesNotMatch(admin,/bridge_ticket_digest/);
console.log(JSON.stringify({ok:true,suite:"baidu-p24-diagnostic-contract",read_only:true,fixed_task:true,redacted:true,result_body_exposed:false,network:false}));
