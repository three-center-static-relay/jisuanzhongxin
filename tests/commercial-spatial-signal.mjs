import assert from "node:assert/strict";
import {commercialSpatialSignalRecipeFor,commercialSpatialSignalRecipeMeta,buildCommercialSpatialSignalRecipeScript} from "../src/commercial-spatial-signal-recipes.js";
import {recipeFor,recipeMeta} from "../src/model-recipe-router.js";
const receipts=[{source:"fixture",digest_sha256:"c".repeat(64)}];
for(const m of ["temporal_state_space_nowcast","spatial_autocorrelation_scan","robust_site_scenario"]){assert.equal(commercialSpatialSignalRecipeFor(`commercial.${m}`).method,m);assert.equal(recipeFor(`commercial.${m}`).method,m)}
const state=buildCommercialSpatialSignalRecipeScript("t-state","commercial.temporal_state_space_nowcast",{source_receipts:receipts,series:Array.from({length:14},(_,i)=>({id:`t${i}`,value:i===5||i===9?null:100+i*3})),horizon:3,seasonal_period:0});
for(const x of ["UnobservedComponents","get_prediction","nowcast-and-forecast-are-inferred-not-observed","state-space-80pct-prediction-interval"])assert.ok(state.includes(x),x);
const spatial=buildCommercialSpatialSignalRecipeScript("t-moran","commercial.spatial_autocorrelation_scan",{source_receipts:receipts,units:Array.from({length:8},(_,i)=>({id:`u${i}`,value:10+i})),edges:Array.from({length:7},(_,i)=>({source:`u${i}`,target:`u${i+1}`,weight:1})),permutations:49});
for(const x of ["global_moran","local_moran","bounded-permutation-significance","spatial-autocorrelation-does-not-identify-cause"])assert.ok(spatial.includes(x),x);
const robust=buildCommercialSpatialSignalRecipeScript("t-robust","commercial.robust_site_scenario",{source_receipts:receipts,draws:800,sites:[{id:"mall-a",metrics:{market:{value:72,low:60,high:82,weight:1.2},access:{value:80,low:70,high:88,weight:1}}},{id:"mall-b",metrics:{market:{value:68,low:55,high:79,weight:1.2},access:{value:84,low:76,high:91,weight:1}}}]});
for(const x of ["probability_best","expected_regret","robust_rank","monte-carlo-propagated-input-intervals","scenario-rank-is-inferred-not-observed"])assert.ok(robust.includes(x),x);
const meta=commercialSpatialSignalRecipeMeta();assert.equal(meta.enable_internet,false);assert.equal(meta.evidence_boundaries.hidden_cluster_is_hypothesis,true);assert.equal(meta.evidence_boundaries.scenario_rank_is_observed,false);assert.ok(recipeMeta().commercial_spatial_signal_methods>=3);
console.log(JSON.stringify({ok:true,suite:"commercial-spatial-signal",methods:meta.methods,observed_phone_lbs:false,robust_site_scenario:true}));
