import assert from "node:assert/strict";
import {COMMERCIAL_SPATIAL_EXCHANGE_VERSION,COMMERCIAL_SPATIAL_HANDOFF_POLICY,validateCommercialSpatialHandoff} from "../src/commercial-spatial-evidence-contract.js";
import {commercialSpatialAdvancedRecipeFor,commercialSpatialAdvancedRecipeMeta,buildCommercialSpatialAdvancedRecipeScript} from "../src/commercial-spatial-advanced-recipes.js";
import {geospatialCommercialRecipeMeta} from "../src/geospatial-commercial-recipes.js";
import {INFERENCE_TOOLKIT} from "../src/inference-toolkit-registry.js";
import {recipeFor,recipeMeta,buildModelRecipeScript} from "../src/model-recipe-router.js";

const digest="b".repeat(64),receipts=[{source:"intelligence-fixture",digest_sha256:digest}];
assert.equal(COMMERCIAL_SPATIAL_HANDOFF_POLICY.cross_center,true);
assert.equal(COMMERCIAL_SPATIAL_HANDOFF_POLICY.raw_person_or_device_trajectories,false);
assert.equal(COMMERCIAL_SPATIAL_HANDOFF_POLICY.modelled_od_is_observed_od,false);
assert.equal(COMMERCIAL_SPATIAL_HANDOFF_POLICY.modelled_footfall_is_observed_footfall,false);
const bundle={contract_version:COMMERCIAL_SPATIAL_EXCHANGE_VERSION,bundle_id:"shared-1",source_receipts:receipts,records:[{record_id:"r1",metric:"parking",evidence_kind:"observed",spatial_unit:{id:"mall-a"},source:{source_url:"https://example.gov.cn/a"}},{record_id:"r2",metric:"footfall",evidence_kind:"inferred",spatial_unit:{id:"mall-a"},source:{source_url:"https://example.gov.cn/a"},quality:{uncertainty:{low:40,high:60}}}]};
const handoff=validateCommercialSpatialHandoff({evidence_bundle:bundle});assert.equal(handoff.shared_bundle,true);assert.equal(handoff.record_count,2);
assert.throws(()=>validateCommercialSpatialHandoff({source_receipts:receipts,device_id:"x"}),/PERSONAL_OR_DEVICE_LEVEL_FIELD_DENIED/);
assert.throws(()=>validateCommercialSpatialHandoff({evidence_bundle:{...bundle,contract_version:"wrong"}}),/CONTRACT_VERSION_MISMATCH/);

const methods=["spatial_gap_gp","synthetic_od_gravity","trade_area_huff","footfall_proxy_nowcast","dwell_proxy_nowcast"];
for(const m of methods){assert.equal(commercialSpatialAdvancedRecipeFor(`commercial.${m}`).method,m);assert.equal(recipeFor(`commercial.${m}`).method,m)}
const meta=commercialSpatialAdvancedRecipeMeta();assert.equal(meta.sensor_parity,false);assert.equal(meta.shared_evidence_contract,COMMERCIAL_SPATIAL_EXCHANGE_VERSION);assert.equal(meta.methods.length,5);
const geo=geospatialCommercialRecipeMeta();assert.equal(geo.evidence_policy.air_quality_in_commercial_core,false);for(const f of ["modelled_footfall_proxy","probabilistic_trade_area","competitor_overlap_proxy","land_transaction_signal","project_pipeline_signal"]){assert.ok(geo.features.includes(f),`missing ${f}`)}
for(const t of ["sklearn_gaussian_process","numpy_gravity_ipf","numpy_huff_trade_area","sklearn_random_forest_nowcast"]){assert.ok(INFERENCE_TOOLKIT.immediate_runtime[t],`missing immediate tool ${t}`)}
for(const t of ["pymc","tensorly","causal_learn","splink","pysal","gstools"]){assert.ok(INFERENCE_TOOLKIT.next_runtime_candidates[t],`missing candidate ${t}`)}

const gpArgs={source_receipts:receipts,feature_names:["population","access"],units:Array.from({length:8},(_,i)=>({id:`u${i}`,lat:26+i*0.01,lon:119+i*0.01,features:{population:50+i,access:40+i},target:i<6?100+i*3:null}))};
const gp=buildCommercialSpatialAdvancedRecipeScript("t-gp","commercial.spatial_gap_gp",gpArgs);assert.match(gp,/GaussianProcessRegressor/);assert.match(gp,/predictive-standard-deviation|predict\(Z,return_std=True\)/);
const od=buildModelRecipeScript("t-od","commercial.synthetic_od_gravity",{source_receipts:receipts,origins:[{id:"o1",mass:100},{id:"o2",mass:80}],destinations:[{id:"d1",attraction:1},{id:"d2",attraction:2}],travel_time_minutes:[[10,20],[15,12]]});assert.match(od,/modelled_od/);assert.match(od,/modelled-od-is-not-observed-od/);
const huff=buildModelRecipeScript("t-huff","commercial.trade_area_huff",{source_receipts:receipts,zones:[{id:"z1",demand:100,profile:{young_share:0.4}},{id:"z2",demand:80,profile:{young_share:0.3}}],sites:[{id:"s1",attractiveness:80},{id:"s2",attractiveness:70}],travel_time_minutes:[[10,20],[18,11]]});assert.match(huff,/competitor_overlap/);assert.match(huff,/aggregate_profile_proxy/);
const now=buildModelRecipeScript("t-foot","commercial.footfall_proxy_nowcast",{source_receipts:receipts,feature_names:["parking","transit"],observations:Array.from({length:16},(_,i)=>({id:`r${i}`,features:{parking:20+i,transit:30+i},observed_footfall:i<12?1000+i*50:null}))});assert.match(now,/RandomForestRegressor/);assert.match(now,/modelled-footfall-is-not-observed-phone-footfall/);
const router=recipeMeta();assert.ok(router.commercial_spatial_advanced_methods>=5);assert.equal(router.commercial_spatial_advanced_sensor_parity,false);

console.log(JSON.stringify({ok:true,suite:"commercial-spatial-advanced",exchange:COMMERCIAL_SPATIAL_EXCHANGE_VERSION,methods,decision_support_target:true,sensor_parity:false}));
