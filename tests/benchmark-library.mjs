import assert from "node:assert/strict";
import {benchmarkMeta,benchmarkPacks,benchmarkPlan,evaluateBenchmarks,validateReferencePack} from "../src/benchmark-library.js";

const meta=benchmarkMeta();
assert.equal(meta.pack_count,18);
assert.equal(meta.principles.goal_separation,true);
assert.equal(meta.principles.no_task_result_as_truth,true);
assert.equal(meta.principles.holdout_required,true);
assert.equal(meta.principles.fail_closed_on_hard_invariants,true);
assert.equal(benchmarkPacks().length,18);

const plan=benchmarkPlan({industry:"commercial_real_estate",risk_level:"high"});
assert.equal(plan.objective_separated_from_truth,true);
assert.equal(plan.required.validation_checks_min,3);
assert.equal(plan.required.stress_required,true);
assert.equal(plan.required.counterexample_required,true);
assert.ok(plan.required.classes.includes("theory_invariant"));
assert.ok(plan.required.classes.includes("empirical_anchor"));

const pack=validateReferencePack({id:"fuzhou-retail-2026q2",version:"1",source:"intelligence-center-authoritative-snapshot",origin:"intelligence_center",digest_sha256:"a".repeat(64),observed_at:"2026-06-30T00:00:00Z",record_count:1280});
assert.equal(pack.immutable,true);
assert.equal(pack.task_writable,false);
await assert.rejects(async()=>validateReferencePack({id:"bad",version:"1",source:"current model",origin:"task_output",digest_sha256:"b".repeat(64),observed_at:"2026-06-30",record_count:1}),/REFERENCE_ORIGIN_FORBIDDEN/);
await assert.rejects(async()=>validateReferencePack({id:"bad",version:"1",source:"desired target",origin:"user_goal",digest_sha256:"b".repeat(64),observed_at:"2026-06-30",record_count:1}),/REFERENCE_ORIGIN_FORBIDDEN/);

const green=evaluateBenchmarks({risk_level:"medium",checks:[
 {id:"unit",class:"theory_invariant",partition:"validation",reference_origin:"theory_invariant",kind:"invariant",passed:true,hard:true},
 {id:"demand",class:"empirical_anchor",partition:"validation",reference_origin:"historical_holdout",kind:"point",value:103,reference:100,tolerance_rel:0.05},
 {id:"stress",class:"stress_scenario",partition:"stress",reference_origin:"synthetic_sanity",kind:"range",value:95,min:80,max:120}
]});
assert.equal(green.state,"green");assert.equal(green.ok,true);

const yellow=evaluateBenchmarks({risk_level:"medium",checks:[
 {id:"unit",class:"theory_invariant",partition:"validation",reference_origin:"theory_invariant",kind:"invariant",passed:true,hard:true},
 {id:"demand",class:"empirical_anchor",partition:"validation",reference_origin:"historical_holdout",kind:"point",value:107.5,reference:100,tolerance_rel:0.05},
 {id:"stress",class:"stress_scenario",partition:"stress",reference_origin:"synthetic_sanity",kind:"range",value:100,min:80,max:120}
]});
assert.equal(yellow.state,"yellow");assert.equal(yellow.ok,true);assert.equal(yellow.action,"recalibrate-or-cross-validate");

const redInvariant=evaluateBenchmarks({risk_level:"low",checks:[
 {id:"probability",class:"theory_invariant",partition:"validation",reference_origin:"theory_invariant",kind:"invariant",passed:false,hard:true}
]});
assert.equal(redInvariant.state,"red");assert.equal(redInvariant.ok,false);assert.ok(redInvariant.reasons.includes("hard-invariant-failed"));

const redHigh=evaluateBenchmarks({risk_level:"high",checks:[
 {id:"v1",class:"theory_invariant",partition:"validation",reference_origin:"theory_invariant",kind:"invariant",passed:true,hard:true},
 {id:"v2",class:"empirical_anchor",partition:"validation",reference_origin:"historical_holdout",kind:"point",value:100,reference:100,tolerance_abs:1},
 {id:"v3",class:"historical_backtest",partition:"validation",reference_origin:"historical_holdout",kind:"range",value:1,min:0,max:2},
 {id:"stress",class:"stress_scenario",partition:"stress",reference_origin:"synthetic_sanity",kind:"range",value:1,min:0,max:2}
]});
assert.equal(redHigh.state,"red");assert.ok(redHigh.reasons.includes("counterexample-required"));

console.log(JSON.stringify({ok:true,suite:"benchmark-library",packs:18,green_yellow_red:true,goal_truth_separated:true,forbidden_task_output_as_truth:true,holdout_policy:true}));
