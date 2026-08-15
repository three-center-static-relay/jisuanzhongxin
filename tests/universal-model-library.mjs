import assert from "node:assert/strict";
import {LOCAL_MODELS,runLocalModel,localModelMeta} from "../src/local-models.js";
import {allModelIds} from "../src/model-registry.js";
import {INDUSTRY_PACKS,STANDARD_WORKFLOWS,industrySummary} from "../src/industry-packs.js";
import {recipeFor,recipeMeta,buildModelRecipeScript} from "../src/model-recipes.js";
import {dispatch} from "../src/kaggle-official.js";

const registry=new Set(allModelIds());
for(const id of ["location_fusion","npv","irr","eoq","inventory_policy","historical_var_es","arc_price_elasticity","hhi","credit_expected_loss","bass_diffusion","sir_local","weibull_reliability_point","fault_tree_independent","pert_schedule","kelly_fraction"])assert.ok(LOCAL_MODELS[id],id);
assert.equal(localModelMeta().calibration_state,"deferred-until-benchmark-library");

const loc=runLocalModel("location_fusion",{cells:[
  {id:"a",population:1000,poi:10,built:20,night:5,traffic:7,growth:2,competition:3,destinations:[{id:"mall1",attraction:100,cost:10},{id:"mall2",attraction:80,cost:20}]},
  {id:"b",population:2000,poi:20,built:30,night:8,traffic:10,growth:3,competition:5,destinations:[{id:"mall1",attraction:100,cost:15},{id:"mall2",attraction:80,cost:12}]}
]});
assert.equal(loc.observed_lbs,false);assert.equal(loc.calibrated,false);assert.equal(loc.proxy_model,true);assert.equal(loc.calibration_state,"deferred-until-benchmark-library");assert.equal(loc.activity_cells.length,2);assert.ok(loc.trade_area);assert.ok(Math.abs(Object.values(loc.trade_area.destination_expected_flow).reduce((s,x)=>s+x,0)-3000)<1e-6);

assert.ok(runLocalModel("npv",{discount_rate:0.1,cash_flows:[-100,60,60]}).npv>0);
assert.ok(runLocalModel("irr",{cash_flows:[-100,60,60]}).irr>0);
assert.ok(runLocalModel("eoq",{annual_demand:10000,order_cost:50,holding_cost_per_unit_year:2}).economic_order_quantity>0);
const risk=runLocalModel("historical_var_es",{alpha:0.95,returns:[0.01,-0.02,0.03,-0.1,0.02,-0.04,0.01,-0.03,0.02,-0.05,0.01,-0.01,0.02,-0.02,0.01,-0.03,0.01,-0.02,0.02,-0.01]});assert.ok(risk.expected_shortfall>=risk.var);
assert.equal(runLocalModel("credit_expected_loss",{exposures:[{id:"x",pd:0.02,lgd:0.4,ead:100000}]}).total_expected_loss,800);
const pert=runLocalModel("pert_schedule",{tasks:[{id:"a",duration:2},{id:"b",duration:3,dependencies:["a"]},{id:"c",duration:1,dependencies:["a"]},{id:"d",duration:4,dependencies:["b","c"]}]});assert.deepEqual(pert.critical_path,["a","b","d"]);assert.equal(pert.project_expected_duration,9);

const summary=industrySummary();assert.ok(summary.industry_pack_count>=18);assert.ok(summary.workflow_count>=6);assert.equal(summary.calibration_state,"deferred-until-benchmark-library");assert.equal(STANDARD_WORKFLOWS.open_location_intelligence.observed_lbs,false);assert.equal(STANDARD_WORKFLOWS.open_location_intelligence.calibration,"deferred-until-benchmark-library");
for(const [packId,pack] of Object.entries(INDUSTRY_PACKS))for(const ref of pack.models)assert.ok(LOCAL_MODELS[ref]||registry.has(ref),`${packId}: invalid model ref ${ref}`);

const recipes=recipeMeta();assert.equal(recipes.arbitrary_code,false);assert.equal(recipes.enable_internet,false);assert.equal(recipes.semantic_aliasing,false);
for(const id of ["policy_economics.econometrics.ols","business_management.segmentation.kmeans","finance_investment.time_series.arima","policy_economics.causal_policy.difference_in_differences","finance_investment.portfolio.min_volatility","operations_supply_chain.linear_optimization.milp","public_health.survival.cox","transport_mobility.network.shortest_path","public_health.epidemic.seir","risk_reliability.extreme.gev","location_intelligence.spatial_grid.h3_grid","social_behavior_psychology.survey_latent.factor_analysis","finance_investment.time_series.state_space","operations_supply_chain.flow.min_cost_flow","public_health.epidemic.network_epidemic"])assert.ok(recipeFor(id),id);
assert.equal(recipeFor("social_behavior_psychology.survey_latent.factor_analysis").recipe,"factor_analysis");assert.equal(recipeFor("finance_investment.time_series.state_space").recipe,"state_space");assert.equal(recipeFor("public_health.epidemic.network_epidemic").recipe,"network_epidemic");
const script=buildModelRecipeScript("recipe-test","policy_economics.econometrics.ols",{X:[[1],[2],[3]],y:[2,4,6],note:"__import__('os').system('bad')"});
for(const bad of ["pip install","subprocess","os.system(","eval(","exec("])assert.equal(script.includes(bad),false,bad);assert.ok(script.includes("model-recipe"));assert.ok(script.includes("statsmodels"));
const networkScript=buildModelRecipeScript("network-test","operations_supply_chain.flow.min_cost_flow",{edges:[["s","t",1,10,2]],source:"s",target:"t"});assert.ok(networkScript.includes("max_flow_min_cost"));
const factorScript=buildModelRecipeScript("factor-test","social_behavior_psychology.survey_latent.factor_analysis",{X:[[1,2],[2,3],[3,4]]});assert.ok(factorScript.includes("FactorAnalysis"));

const calls=[],oldFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,init={})=>{const body=init.body?JSON.parse(init.body):{};calls.push({url:String(url),body});if(String(url).includes("IntrospectToken"))return new Response(JSON.stringify({active:true,username:"tester",userId:1,scope:"read write"}),{status:200,headers:{"content-type":"application/json"}});if(String(url).includes("SaveKernel"))return new Response(JSON.stringify({ref:"tester/model-recipe",versionNumber:1}),{status:200,headers:{"content-type":"application/json"}});throw new Error("UNEXPECTED_FETCH:"+url)};
  const out=await dispatch({KAGGLE_API_TOKEN:"secret"},{task_id:"model-recipe-test",profile:"model",input:{model_recipe:{model_id:"policy_economics.econometrics.ols",args:{X:[[1],[2],[3]],y:[2,4,6]}}},timeout_seconds:300,gpu:false});assert.equal(out.machine_shape,"cpu");const save=calls.find(x=>x.url.includes("SaveKernel"));assert.ok(save);assert.equal(save.body.enableInternet,false);assert.equal(save.body.isPrivate,true);assert.equal(save.body.enableGpu,false);assert.ok(String(save.body.text).includes("model-recipe"));assert.equal(String(save.body.text).includes("pip install"),false);
}finally{globalThis.fetch=oldFetch}
console.log(JSON.stringify({ok:true,suite:"universal-model-library",industry_packs:summary.industry_pack_count,local_models:Object.keys(LOCAL_MODELS).length,recipe_methods:recipes.methods.length,arbitrary_code:false,calibration_deferred:true,observed_lbs_claim:false,semantic_recipe_checks:true}));
