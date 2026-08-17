import assert from "node:assert/strict";
import {commercialSpatialSignalRecipeFor,commercialSpatialSignalRecipeMeta,buildCommercialSpatialSignalRecipeScript} from "../src/commercial-spatial-signal-recipes.js";
import {recipeFor,recipeMeta} from "../src/model-recipe-router.js";
const receipts=[{source:"fixture",digest_sha256:"c".repeat(64)}];
for(const m of ["temporal_state_space_nowcast","spatial_autocorrelation_scan"]){assert.equal(commercialSpatialSignalRecipeFor(`commercial.${m}`).method,m);assert.equal(recipeFor(`commercial.${m}`).method,m)}
const state=buildCommercialSpatialSignalRecipeScript("t-state","commercial.temporal_state_space_nowcast",{source_receipts:receipts,series:Array.from({length:14},(_,i)=>({id:`t${i}`,value:i===5||i===9?null:100+i*3})),horizon:3,seasonal_period:0});
for(const x of ["UnobservedComponents","get_prediction","nowcast-and-forecast-are-inferred-not-observed","state-space-80pct-prediction-interval"])assert.ok(state.includes(x),x);
const spatial=buildCommercialSpatialSignalRecipeScript("t-moran","commercial.spatial_autocorrelation_scan",{source_receipts:receipts,units:Array.from({length:8},(_,i)=>({id:`u${i}`,value:10+i})),edges:Array.from({length:7},(_,i)=>({source:`u${i}`,target:`u${i+1}`,weight:1})),permutations:49});
for(const x of ["global_moran","local_moran","bounded-permutation-significance","spatial-autocorrelation-does-not-identify-cause"])assert.ok(spatial.includes(x),x);
const meta=commercialSpatialSignalRecipeMeta();assert.equal(meta.enable_internet,false);assert.equal(meta.evidence_boundaries.hidden_cluster_is_hypothesis,true);assert.ok(recipeMeta().commercial_spatial_signal_methods>=2);
console.log(JSON.stringify({ok:true,suite:"commercial-spatial-signal",methods:meta.methods,observed_phone_lbs:false}));
