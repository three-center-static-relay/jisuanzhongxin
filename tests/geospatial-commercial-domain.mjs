import assert from "node:assert/strict";
import {recipeFor,recipeMeta,buildModelRecipeScript} from "../src/model-recipe-router.js";
import {geospatialCommercialRecipeMeta} from "../src/geospatial-commercial-recipes.js";

const meta=geospatialCommercialRecipeMeta();
assert.equal(meta.enable_internet,false);
assert.equal(meta.arbitrary_code,false);
assert.equal(meta.observed_lbs,false);
assert.equal(meta.raw_bulk_data,false);
assert.equal(meta.spatial_unit_policy.includes("h3"),true);
for(const m of ["spatial_feature_fusion","site_ranking","white_space"])assert.equal(meta.methods.includes(m),true);
for(const reused of ["facility_location","vrp","change_point","effect_estimation","sobol","multinomial_logit"])assert.equal(JSON.stringify(meta.reused_shared_models).includes(reused),true);

const digest="a".repeat(64);
const args={
  source_receipts:[{source:"worldpop",digest_sha256:digest},{source:"overture_maps",digest_sha256:"b".repeat(64)},{source:"baidu_traffic",digest_sha256:"c".repeat(64)}],
  units:[
    {id:"h3:8941b530807ffff",features:{population_market:88,working_age:72,poi_supply:75,poi_diversity:82,building_intensity:79,nonresidential_built:84,night_activity:76,walk_accessibility:90,transit_accessibility:86,competition_pressure:70,hazard_risk:15}},
    {id:"h3:8941b53080fffff",features:{population_market:73,working_age:68,poi_supply:55,poi_diversity:64,building_intensity:61,night_activity:58,walk_accessibility:70,transit_accessibility:62,competition_pressure:38,hazard_risk:12}}
  ]
};
for(const model of ["geospatial_commercial.spatial_feature_fusion","geospatial_commercial.site_ranking","geospatial_commercial.white_space"]){
  const r=recipeFor(model);assert.ok(r);assert.equal(r.recipe,"geospatial_commercial_feature_fusion");
  const script=buildModelRecipeScript("geo-domain-test",model,args);
  assert.equal(typeof script,"string");
  assert.equal(script.includes("THREE_CENTER_RESULT:"),true);
  assert.equal(script.includes("network_used\":False"),true);
  assert.equal(script.includes("observed_lbs\":False"),true);
  assert.equal(script.includes("requests"),false);
  assert.equal(script.includes("subprocess"),false);
  assert.equal(script.includes("http://"),false);
  assert.equal(script.includes("https://"),false);
}
assert.throws(()=>buildModelRecipeScript("x","geospatial_commercial.site_ranking",{units:[],source_receipts:[]}),/INVALID_SPATIAL_UNITS/);
const all=recipeMeta();
assert.equal(all.geospatial_commercial_methods,3);
assert.equal(all.geospatial_commercial_observed_lbs,false);
assert.equal(all.geospatial_commercial_domain.enable_internet,false);
console.log(JSON.stringify({ok:true,suite:"geospatial-commercial-domain",methods:meta.methods,reused_shared_models:meta.reused_shared_models,network:false,observed_lbs:false}));
