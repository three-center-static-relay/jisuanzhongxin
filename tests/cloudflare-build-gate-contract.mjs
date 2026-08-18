import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const wrangler=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));

assert.equal(pkg.scripts?.["cf:build"],"npm run test:build-gate");
assert.equal(pkg.scripts?.["cf:preview"],"npm run cf:build && npx wrangler deploy --dry-run");
assert.equal(pkg.scripts?.["cf:deploy"],"npm run cf:build && npx wrangler deploy");
assert.equal(pkg.devDependencies?.wrangler,"4.123.0");
assert.equal(pkg.devDependencies?.msw,"2.15.0");
assert.match(pkg.scripts?.["test:build-gate"]||"",/tests\/cloudflare-build-gate-contract\.mjs/);
assert.equal(wrangler.name,"compute-worker");
assert.equal(wrangler.workers_dev,false,"internal center must be service-binding only");
assert.equal(wrangler.preview_urls,false,"internal center preview URLs must remain disabled");
assert.deepEqual(wrangler.secrets?.required,["KAGGLE_API_TOKEN"]);
assert.equal(wrangler.build,undefined,"Workers Builds ignores Wrangler custom builds; the dashboard deploy command must invoke cf:build explicitly");

console.log(JSON.stringify({ok:true,suite:"cloudflare-build-gate-contract",worker:wrangler.name,preview_is_local_validation:true}));
