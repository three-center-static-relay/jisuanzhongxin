import assert from "node:assert/strict";
import {modalHealth,modalMeta} from "../src/modal.js";

const meta=modalMeta();
assert.equal(meta.provider,"modal");
assert.equal(meta.subscription_usd_monthly,0);
assert.equal(meta.recurring_free_compute_credit_usd_monthly,30);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.free_credit_only,true);
assert.equal(meta.route_eligible,false);
assert.equal(meta.token_id_env,"MODAL_TOKEN_ID");
assert.equal(meta.token_secret_env,"MODAL_TOKEN_SECRET");

const missing=modalHealth({});
assert.equal(missing.ok,false);
assert.equal(missing.route_eligible,false);
assert.equal(missing.secret_echo,false);

const present=modalHealth({MODAL_TOKEN_ID:"test-id",MODAL_TOKEN_SECRET:"test-secret"});
assert.equal(present.ok,true);
assert.equal(present.authenticated,false);
assert.equal(present.route_eligible,false);
assert.equal(present.secret_echo,false);

console.log(JSON.stringify({ok:true,suite:"modal-provider",free_credit_only:true,paid_fallback:false,route_eligible:false}));
