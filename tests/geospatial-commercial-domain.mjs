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
assert.equal(meta.evidence_policy.search_engines_are_feature_sources,false);
assert.equal(meta.evidence_policy.public_aggregate_mobility_is_phone_lbs,false);
assert.equal(meta.evidence_policy.modelled_od_is_observed_od,false);
assert.equal(meta.evidence_policy.modelled_dwell_is_observed_dwell,false);
for(const m of ["spatial_feature_fusion","site_ranking","white_space"])assert.equal(meta.methods.includes(m),true);
for(const f of ["built_land_cover","green_space","chain_brand_density","vacancy_risk","population_nowcast","activity_chain_demand","modelled_od_demand","modelled_destination_attraction","modelled_dwell_proxy","temporal_accessibility","observed_public_transport_activity","observed_parking_occupancy","observed_shared_bike_activity","observed_road_speed_activity","poi_turnover","commercial_supply_change"]){assert.equal(meta.features.includes(f),true,`missing feature ${f}`)}
for(const f of ["air_quality_exposure","project_pipeline_activity","commercial_open_close_momentum","planning_policy_signal","retail_rent_pressure","investment_activity_signal","web_market_momentum"]){assert.equal(meta.features.includes(f),false)}
for(const reused of ["facility_location","vrp","change_point","effect_estimation","sobol","multinomial_logit"])assert.equal(JSON.stringify(meta.reused_shared_models).includes(reused),true);
assert.equal(meta.mobility_digital_twin.public_observation_calibration,true);

const digest="a".repeat(64);
const args={
  source_receipts:[
    {source:"worldpop",digest_sha256:digest},{source:"esa_worldcover",digest_sha256:"b".repeat(64)},
    {source:"baidu_traffic",digest_sha256:"c".repeat(64)},{source:"overture_maps",digest_sha256:"d".repeat(64)},
    {source:"cmab_china",digest_sha256:"e".repeat(64)},{source:"beijing_public_mobility",digest_sha256:"f".repeat(64)}
  ],
  units:[
    {id:"h3:8941b530807ffff",features:{population_market:88,working_age:72,population_nowcast:85,activity_chain_demand:82,modelled_od_demand:80,modelled_destination_attraction:84,modelled_dwell_proxy:70,poi_supply:75,poi_diversity:82,brand_presence:78,chain_brand_density:70,poi_turnover:65,commercial_supply_change:68,building_intensity:79,nonresidential_built:84,built_land_cover:86,green_space:35,night_activity:76,walk_accessibility:90,drive_accessibility:82,transit_accessibility:86,temporal_accessibility:88,road_traffic:74,observed_public_transport_activity:79,observed_parking_occupancy:72,observed_shared_bike_activity:68,observed_road_speed_activity:76,competition_pressure:70,hazard_risk:15,vacancy_risk:18}},
    {id:"h3:8941b53080fffff",features:{population_market:73,working_age:68,population_nowcast:70,activity_chain_demand:65,modelled_od_demand:61,modelled_destination_attraction:64,modelled_dwell_proxy:58,poi_supply:55,poi_diversity:64,brand_presence:52,building_intensity:61,built_land_cover:67,green_space:60,night_activity:58,walk_accessibility:70,drive_accessibility:75,transit_accessibility:62,temporal_accessibility:66,observed_public_transport_activity:59,observed_parking_occupancy:63,competition_pressure:38,hazard_risk:12,vacancy_risk:28}}
  ]
};
for(const model of ["geospatial_commercial.spatial_feature_fusion","geospatial_commercial.site_ranking","geospatial_commercial.white_space"]){
  const r=recipeFor(model);assert.ok(r);assert.equal(r.recipe,"geospatial_commercial_feature_fusion");
  const script=buildModelRecipeScript("geo-domain-test",model,args);
  assert.equal(typeof script,"string");
  assert.equal(script.includes("THREE_CENTER_RESULT:"),true);
  assert.equal(script.includes("network_used\":False"),true);
  assert.equal(script.includes("observed_lbs\":False"),true);
  assert.equal(script.includes("public_aggregate_mobility_is_phone_lbs\":False"),true);
  assert.equal(script.includes("modelled_od_is_observed_od\":False"),true);
  assert.equal(script.includes("modelled_dwell_is_observed_dwell\":False"),true);
  assert.equal(script.includes("air_quality_exposure"),false);
  assert.equal(script.includes("web_market_momentum"),false);
  assert.equal(script.includes("project_pipeline_activity"),false);
  assert.equal(script.includes("search-engines-are-discovery-only-not-spatial-feature-sources"),true);
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
console.log(JSON.stringify({ok:true,suite:"geospatial-commercial-domain",methods:meta.methods,reused_shared_models:meta.reused_shared_models,mobility_digital_twin:true,public_aggregate_is_phone_lbs:false,modelled_od_is_observed_od:false,modelled_dwell_is_observed_dwell:false,discovery_search_feature_sources:false,air_quality_in_commercial_core:false,network:false,observed_lbs:false}));
