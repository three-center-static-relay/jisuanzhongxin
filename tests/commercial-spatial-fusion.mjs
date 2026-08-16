import assert from "node:assert/strict";
import {recipeFor,recipeMeta,buildModelRecipeScript} from "../src/model-recipe-router.js";

const D="a".repeat(64);
const args={
  source_receipts:[
    {source:"worldpop",result_digest:D},
    {source:"tencent_maps_poi",result_digest:"b".repeat(64)},
    {source:"baidu_traffic",result_digest:"c".repeat(64)},
    {source:"amap_routing",result_digest:"d".repeat(64)}
  ],
  rings:[
    {radius_m:1000,population:97384.79,area_km2:3.093,working_age_share:0.72,poi_total:240,competitor_count:3,transit_count:5,nearest_transit_walk_min:6.1,traffic_status:2},
    {radius_m:3000,population:640288.44,area_km2:27.837,working_age_share:0.722,poi_total:950,competitor_count:12,transit_count:20,nearest_transit_walk_min:6.1,traffic_status:2}
  ]
};
for(const id of ["location_intelligence.commercial_spatial_fusion","location_intelligence.location_fusion","location_intelligence.three_ring_trade_area","location_intelligence.accessibility_score","location_intelligence.competitor_diversion"]){
  assert.equal(recipeFor(id)?.recipe,"commercial_spatial_fusion",id);
  const script=buildModelRecipeScript("powerlong-contract",id,args);
  assert.match(script,/observed_lbs/);
  assert.match(script,/real_footfall/);
  assert.match(script,/network_used/);
  assert.match(script,/proxy-not-observed-phone-footfall/);
  assert.match(script,/CUMULATIVE_POPULATION_MUST_NOT_DECREASE/);
  assert.doesNotMatch(script,/https?:\/\//);
}
const meta=recipeMeta();
assert.equal(meta.enable_internet,false);
assert.equal(meta.arbitrary_code,false);
assert.equal(meta.commercial_spatial_observed_lbs,false);
assert.ok(meta.methods.includes("commercial_spatial_fusion"));
assert.throws(()=>buildModelRecipeScript("bad","location_intelligence.commercial_spatial_fusion",{rings:args.rings,source_receipts:[args.source_receipts[0]]}),/SOURCE_RECEIPTS_REQUIRED/);
assert.throws(()=>buildModelRecipeScript("bad","location_intelligence.commercial_spatial_fusion",{rings:[],source_receipts:args.source_receipts}),/INVALID_TRADE_AREA_RINGS/);
console.log(JSON.stringify({ok:true,suite:"commercial-spatial-fusion",powerlong_contract:true,source_receipts_required:true,network:false,observed_lbs:false,raw_bulk_data:false}));
