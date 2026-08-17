import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeKaggleHealth,normalizeKaggleMeta,normalizeModalHealth,normalizeModalMeta,normalizeProviderTruth} from "../src/provider-truth.js";

const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");

const kaggleMeta=normalizeKaggleMeta({ok:true,business_e2e:true,route_eligible:true,acceptance_state:"verified-current-cpu-t4-e2e"});
assert.equal(kaggleMeta.historically_verified,true);
assert.equal(kaggleMeta.business_e2e,false);
assert.equal(kaggleMeta.business_e2e_current,false);
assert.equal(kaggleMeta.business_e2e_historically_verified,true);
assert.equal(kaggleMeta.current_live_health_verified,false);
assert.equal(kaggleMeta.route_eligible,false);
assert.equal(kaggleMeta.acceptance_state,"historical-cpu-t4-e2e-live-health-required");

const kaggleHealth=normalizeKaggleHealth({ok:true,authenticated:true,route_eligible:true,business_e2e:true});
assert.equal(kaggleHealth.current_live_health_verified,true);
assert.equal(kaggleHealth.route_eligible,true);
assert.equal(kaggleHealth.business_e2e,false);
assert.equal(kaggleHealth.business_e2e_current,false);
assert.equal(kaggleHealth.business_e2e_historically_verified,true);
assert.equal(kaggleHealth.acceptance_state,"live-auth-health-pass-historical-cpu-t4-e2e");

const kaggleFailed=normalizeKaggleHealth({ok:false,authenticated:false,route_eligible:true});
assert.equal(kaggleFailed.current_live_health_verified,false);
assert.equal(kaggleFailed.route_eligible,false);
assert.equal(kaggleFailed.business_e2e,false);

const modalMeta=normalizeModalMeta({ok:true,historically_verified:true,route_eligible:true,acceptance_state:"cpu-t4-e2e-verified"});
assert.equal(modalMeta.historical_cpu_t4_e2e_verified,true);
assert.equal(modalMeta.current_cpu_t4_e2e_verified,false);
assert.equal(modalMeta.current_live_health_verified,false);
assert.equal(modalMeta.route_eligible,false);
assert.equal(modalMeta.acceptance_state,"historical-cpu-t4-e2e-live-health-required");

const modalHealth=normalizeModalHealth({ok:true,authenticated:true,route_eligible:true,acceptance_state:"https-bridge-authenticated-cpu-t4-verified"});
assert.equal(modalHealth.historical_cpu_t4_e2e_verified,true);
assert.equal(modalHealth.current_cpu_t4_e2e_verified,false);
assert.equal(modalHealth.current_live_health_verified,true);
assert.equal(modalHealth.route_eligible,true);
assert.equal(modalHealth.acceptance_state,"live-health-pass-historical-cpu-t4-e2e");

const summary=normalizeProviderTruth("/health",{compute_backends:{kaggle:{route_eligible:true,acceptance_state:"verified-current-cpu-t4-e2e"},modal:{route_eligible:true,acceptance_state:"cpu-t4-e2e-verified"}}});
assert.equal(summary.compute_backends.kaggle.route_eligible,false);
assert.equal(summary.compute_backends.kaggle.current_live_health_verified,false);
assert.equal(summary.compute_backends.kaggle.business_e2e_current,false);
assert.equal(summary.compute_backends.modal.route_eligible,false);
assert.equal(summary.compute_backends.modal.current_live_health_verified,false);
assert.equal(summary.compute_backends.modal.current_cpu_t4_e2e_verified,false);

const caps=normalizeProviderTruth("/v1/capabilities",{capabilities:{kaggle_current_cpu_t4_e2e_verified:true}});
assert.equal(caps.capabilities.kaggle_current_cpu_t4_e2e_verified,false);
assert.equal(caps.capabilities.kaggle_historical_cpu_t4_e2e_verified,true);
assert.equal(caps.capabilities.modal_current_cpu_t4_e2e_verified,false);
assert.equal(caps.capabilities.modal_historical_cpu_t4_e2e_verified,true);

const acceptance=normalizeProviderTruth("/v1/acceptance/latest",{providers:{kaggle:"verified-current-cpu-t4-e2e-live-health-required",modal:"cpu-t4-e2e-verified-live-health-required-bounded-route"}});
assert.match(acceptance.providers.kaggle,/historical-cpu-t4-e2e/);
assert.match(acceptance.providers.kaggle,/current-e2e-not-asserted/);
assert.match(acceptance.providers.modal,/historical-cpu-t4-e2e/);
assert.match(acceptance.providers.modal,/current-e2e-not-asserted/);

assert.match(entry,/patchProviderTruthResponse/);
assert.match(entry,/normalizeModalMeta\(modalMeta\(\)\)/);
assert.match(entry,/normalizeModalHealth\(await publicModalHealth\(env\)\)/);

console.log(JSON.stringify({ok:true,suite:"provider-truth-semantics",historical_e2e_separate:true,live_health_separate:true,static_summary_fail_closed:true,current_e2e_not_asserted_without_selftest:true}));
