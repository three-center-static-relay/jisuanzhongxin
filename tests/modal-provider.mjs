import assert from "node:assert/strict";
import fs from "node:fs";
import {modalHealth,modalMeta} from "../src/modal.js";

const source=fs.readFileSync(new URL("../src/modal.js",import.meta.url),"utf8");
const meta=modalMeta();
assert.equal(meta.provider,"modal");
assert.equal(meta.subscription_usd_monthly,0);
assert.equal(meta.recurring_free_compute_credit_usd_monthly,30);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.free_credit_only,true);
assert.equal(meta.historically_verified,true);
assert.equal(meta.route_eligible,false);
assert.equal(meta.route_eligibility,"live-health-required");
assert.equal(meta.api_token_id_env,"MODAL_TOKEN_ID");
assert.equal(meta.api_token_secret_env,"MODAL_TOKEN_SECRET");

const missing=await modalHealth({});
assert.equal(missing.ok,false);
assert.equal(missing.route_eligible,false);
assert.equal(missing.secret_echo,false);
assert.equal(missing.acceptance_state,"https-bridge-config-required");

assert.match(source,/route_eligible:ok/);
assert.match(source,/route_eligible:checksumOk/);
assert.match(source,/route_eligible:gpuOk/);
assert.match(source,/route_eligible:false/);

console.log(JSON.stringify({ok:true,suite:"modal-provider",free_credit_only:true,paid_fallback:false,static_route_eligible:false,live_health_required:true,selftest_route_truth:true}));
