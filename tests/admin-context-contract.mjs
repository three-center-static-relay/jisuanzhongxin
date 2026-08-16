import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

assert.match(entry,/\/v1\/admin\/context/);
assert.match(entry,/compute\.internal/);
assert.match(entry,/admin_read_only:true/);
assert.match(entry,/CF_VERSION_METADATA/);
assert.match(entry,/active_task:gate\.active\|\|null/);
assert.match(entry,/secrets_redacted:true/);
assert.match(wrangler,/"main"\s*:\s*"src\/admin-entry\.js"/);
assert.match(wrangler,/"version_metadata"\s*:\s*\{\s*"binding"\s*:\s*"CF_VERSION_METADATA"\s*\}/);

console.log(JSON.stringify({ok:true,suite:"compute-admin-context-contract",read_only:true,internal_only:true,version_metadata:true}));
