import assert from "node:assert/strict";
import {recipeFor,recipeMeta,buildModelRecipeScript} from "../src/model-recipe-router.js";
import {geospatialCommercialRecipeMeta} from "../src/geospatial-commercial-recipes.js";

const meta=geospatialCommercialRecipeMeta();
assert.equal(meta.enable_internet,false);
assert.equal(meta.arbitrary_code,false);
assert.equal(meta.observed_lbs,false);
assert.equal(meta.raw_bulk_data,false);
assert.equal(meta.spatial_unit_policy.includes("h3"),true);
assert.equal(meta.evidence_policy.air_quality_in_commercial_core,false);
for(const m of ["spatial_feature_fusion","site_ranking","white_space"])assert.equal(meta.methods.includes(m),true);
for(const f of ["built_land_cover","green_space","project_pipeline_activity","commercial_open_close_momentum","planning_policy_signal","retail_rent_pressure","investment_activity_signal","web_market_momentum"]){assert.equal(meta.features.includes(f),true)}
assert.equal(meta.features.includes("air_quality_exposure"),false);
for(const reused of ["facility_location","vrp","change_point","effect_estimation","sobol","multinomial_logit"])assert.equal(JSON.stringify(meta.reused_shared_models).includes(reused),true);

const digest="a".repeat(64);
const args={
  source_receipts:[
    {source:"worldpop",digest_sha256:digest},{source:"esa_worldcover",digest_sha256:"b".repeat(64)},
    {source:"baidu_traffic",digest_sha256:"c".repeat(64)},{source:"commercial_web_research",digest_sha256:"d".repeat(64)},
    {source:"overture_maps",digest_sha256:"e".repeat(64)}
  ],
  units:[
    {id:"h3:8941b530807ffff",features:{population_market:88,working_age:72,poi_supply:75,poi_diversity:82,brand_presence:78,chain_brand_density:70,building_intensity:79,nonresidential_built:84,built_land_cover:86,green_space:35,night_activity:76,walk_accessibility:90,drive_accessibility:82,transit_accessibility:86,road_traffic:74,competition_pressure:70,hazard_risk:15,vacancy_risk:18,project_pipeline_activity:80,commercial_open_close_momentum:73,planning_policy_signal:76,retail_rent_pressure:68,investment_activity_signal:77,web_market_momentum:81}},
    {id:"h3:8941b53080fffff",features:{population_market:73,working_age:68,poi_supply:55,poi_diversity:64,brand_presence:52,building_intensity:61,built_land_cover:67,green_space:60,night_activity:58,walk_accessibility:70,drive_accessibility:75,transit_accessibility:62,competition_pressure:38,hazard_risk:12,vacancy_risk:28,project_pipeline_activity:50,commercial_open_close_momentum:48,planning_policy_signal:55,retail_rent_pressure:42,investment_activity_signal:53,web_market_momentum:49}}
  ]
};
for(const model of ["geospatial_commercial.spatial_feature_fusion","geospatial_commercial.site_ranking","geospatial_commercial.white_space"]){
  const r=recipeFor(model);assert.ok(r);assert.equal(r.recipe,"geospatial_commercial_feature_fusion");
  const script=buildModelRecipeScript("geo-domain-test",model,args);
  assert.equal(typeof script,"string");
  assert.equal(script.includes("THREE_CENTER_RESULT:"),true);
  assert.equal(script.includes("network_used\":False"),true);
  assert.equal(script.includes("observed_lbs\":False"),true);
  assert.equal(script.includes("air_quality_exposure"),false);
  assert.equal(script.includes("web_market_momentum"),true);
  assert.equal(script.includes("project_pipeline_activity"),true);
  assert.equal(script.includes("commercial_open_close_momentum"),true);
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
console.log(JSON.stringify({ok:true,suite:"geospatial-commercial-domain",methods:meta.methods,reused_shared_models:meta.reused_shared_models,commercial_features:["project_pipeline_activity","commercial_open_close_momentum","planning_policy_signal","retail_rent_pressure","investment_activity_signal","web_market_momentum"],air_quality_in_commercial_core:false,network:false,observed_lbs:false}));
