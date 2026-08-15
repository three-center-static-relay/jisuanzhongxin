import assert from "node:assert/strict";
import {runLocalModel,localModelMeta} from "../src/local-models.js";
import {MODEL_REGISTRY,registrySummary,domainModels} from "../src/model-registry.js";

const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const meta=localModelMeta();
assert.equal(meta.arbitrary_code,false);
for(const id of ["three_ring_trade_area","huff_trade_area","gravity_od","competitor_diversion","accessibility_score","weighted_index","bayesian_evidence_fusion","pagerank","threshold_diffusion","mm1_queue","black_scholes"])assert.ok(meta.model_ids.includes(id),id);

const rings=runLocalModel("three_ring_trade_area",{core_minutes:10,secondary_minutes:20,fringe_minutes:30,items:[{id:"a",travel_time:5,population:100},{id:"b",travel_time:15,population:200},{id:"c",travel_time:25,population:300},{id:"d",travel_time:40,population:400}]});
assert.equal(rings.rings.core.length,1);assert.equal(rings.rings.secondary.length,1);assert.equal(rings.rings.fringe.length,1);assert.equal(rings.rings.outside.length,1);assert.equal(rings.metrics.core.demand,100);

const huff=runLocalModel("huff_trade_area",{alpha:1,beta:2,origins:[{id:"o1",demand:1000,destinations:[{id:"mallA",attraction:100,cost:10},{id:"mallB",attraction:100,cost:20}]}]});
const hp=huff.origins[0].probabilities;close(hp.reduce((s,x)=>s+x.probability,0),1);close(hp.reduce((s,x)=>s+x.expected_flow,0),1000);assert.ok(hp[0].probability>hp[1].probability);

const gravity=runLocalModel("gravity_od",{beta:0.1,origins:[{id:"o1",mass:100},{id:"o2",mass:200}],destinations:[{id:"a",mass:50},{id:"b",mass:50}],cost_matrix:[[5,15],[10,10]]});
close(Object.values(gravity.destination_flow).reduce((s,x)=>s+x,0),300,1e-6);

const diverted=runLocalModel("competitor_diversion",{target_id:"mallA",origins:[{id:"o",demand:100,destinations:[{id:"mallA",attraction:100,cost:10},{id:"mallB",attraction:80,cost:12},{id:"mallC",attraction:50,cost:8}]}]});
assert.ok(diverted.target_expected_flow>0);close(Object.values(diverted.diverted_to).reduce((s,x)=>s+x,0),diverted.target_expected_flow,1e-6);

const idx=runLocalModel("weighted_index",{features:[{id:"population",value:80,min:0,max:100,weight:2},{id:"competition",value:20,min:0,max:100,weight:1,direction:"negative"}]});
assert.ok(idx.score_0_100>0&&idx.score_0_100<=100);

const bayes=runLocalModel("bayesian_evidence_fusion",{prior_probability:0.5,evidence:[{id:"e1",likelihood_ratio:4},{id:"e2",likelihood_ratio:2}]});
close(bayes.posterior_probability,8/9,1e-9);

const pr=runLocalModel("pagerank",{nodes:["a","b","c"],edges:[{source:"a",target:"b"},{source:"b",target:"c"},{source:"c",target:"b"}]});
close(pr.scores.reduce((s,x)=>s+x.score,0),1,1e-6);

const diff=runLocalModel("threshold_diffusion",{nodes:[{id:"a",threshold:0},{id:"b",threshold:0.5},{id:"c",threshold:0.5}],edges:[{source:"a",target:"b"},{source:"b",target:"c"}],seeds:["a"]});
assert.equal(diff.active_count,3);

const q=runLocalModel("mm1_queue",{arrival_rate:8,service_rate:10});close(q.utilization,0.8);assert.throws(()=>runLocalModel("mm1_queue",{arrival_rate:10,service_rate:10}),/QUEUE_UNSTABLE/);
const bs=runLocalModel("black_scholes",{spot:100,strike:100,time_years:1,rate:0.05,volatility:0.2});assert.ok(bs.call>0&&bs.put>0);

const summary=registrySummary();
assert.ok(summary.domain_count>=12);assert.ok(summary.model_groups>=50);assert.equal(summary.calibration_state,"deferred-until-benchmark-library");
for(const d of ["location_intelligence","finance_investment","business_management","intelligence_analysis","social_behavior_psychology","policy_economics","operations_supply_chain","marketing_growth","risk_reliability","real_estate_urban","transport_mobility","energy_environment","public_health"])assert.ok(domainModels(d),d);
assert.equal(MODEL_REGISTRY.location_intelligence.models.calibration.execution,"deferred-benchmark-library");
console.log(JSON.stringify({ok:true,suite:"model-library",domains:summary.domain_count,model_groups:summary.model_groups,local_models:meta.model_ids.length,arbitrary_code:false,calibration_deferred:true}));
