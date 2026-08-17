import assert from "node:assert/strict";
import fs from "node:fs";
import {KAGGLE_ACCEPTANCE_HISTORY} from "../src/kaggle-acceptance-history.js";
import {recipeFor} from "../src/model-recipe-router.js";
import {normalizeKaggleMeta} from "../src/provider-truth.js";

const admin=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const wrapperUrl=new URL("../src/production-entry-kaggle-robust-site-e2e.js",import.meta.url);
const recipe=recipeFor("commercial.robust_site_scenario");
const ev=KAGGLE_ACCEPTANCE_HISTORY.latest_recipe_attempt;

assert.ok(recipe);
assert.equal(recipe.recipe,"commercial_spatial_signal_v2");
assert.equal(recipe.method,"robust_site_scenario");
assert.equal(ev.task_id,"kaggle-recipe-live-20260817-robust-site-cpu");
assert.equal(ev.model_id,"commercial.robust_site_scenario");
assert.equal(ev.recipe,"commercial_spatial_signal_v2");
assert.equal(ev.method,"robust_site_scenario");
assert.equal(ev.intended_accelerator,"cpu");
assert.equal(ev.intended_draws,500);
assert.equal(ev.one_shot,true);
assert.equal(ev.automatic_retry,false);
assert.equal(ev.trigger_build_conclusion,"failure");
assert.equal(ev.task_created,false);
assert.equal(ev.task_absence_verified,true);
assert.equal(ev.task_absence_http_status,404);
assert.equal(ev.kernel_creation_confirmed,false);
assert.equal(ev.result_digest,null);
assert.equal(ev.result_verified,false);
assert.equal(ev.fresh_e2e_verified,false);
assert.equal(ev.root_cause,"UNRESOLVED_PRE_TASK_GATE");
assert.equal(ev.current_auth_health_verified_after_attempt,true);
assert.equal(ev.current_live_health_http_status_after_attempt,200);
assert.equal(ev.current_business_e2e_asserted,false);
assert.equal(ev.retry_performed,false);
assert.equal(ev.production_promoted,false);

const meta=normalizeKaggleMeta({ok:true,business_e2e:true,route_eligible:true});
assert.equal(meta.business_e2e,false);
assert.equal(meta.business_e2e_current,false);
assert.equal(meta.route_eligible,false);
assert.deepEqual(meta.latest_recipe_acceptance,ev);

assert.match(admin,/from "\.\/production-entry\.js"/);
assert.doesNotMatch(admin,/production-entry-kaggle-robust-site-e2e\.js/);
assert.equal(fs.existsSync(wrapperUrl),false);
assert.match(wrangler,/kaggle-robust-site-e2e-contract\.mjs/);
assert.match(wrangler,/"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["17 4 \* \* \*"\]\s*\}/);
assert.doesNotMatch(wrangler,/"\* \* \* \* \*"/);

console.log(JSON.stringify({ok:true,suite:"kaggle-robust-site-acceptance-history",task_id:ev.task_id,model_id:ev.model_id,fresh_e2e_verified:false,task_created:false,task_absence_http_status:404,current_auth_health_verified_after_attempt:true,result_digest:null,retry_performed:false,acceptance_wrapper_removed:true,production_promoted:false}));
