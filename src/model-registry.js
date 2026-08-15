const DOMAIN=(label,models)=>Object.freeze({label,models:Object.freeze(models)});
const M=(role,execution,methods,packages=[],notes="")=>Object.freeze({role,execution,methods:Object.freeze(methods),packages:Object.freeze(packages),notes});

export const MODEL_REGISTRY=Object.freeze({
  location_intelligence:DOMAIN("位置与商圈智能",{
    three_ring_trade_area:M("核心/次级/边缘三圈商圈划分","local-model",["three_ring_trade_area"]),
    huff_trade_area:M("概率商圈与门店吸引概率","local-model",["huff_trade_area"]),
    gravity_od:M("人口-吸引力-阻抗合成OD","local-model",["gravity_od"]),
    competitor_diversion:M("竞品分流与关闭/新增情景","local-model",["competitor_diversion"]),
    accessibility:M("时间/距离衰减可达性","local-model",["accessibility_score"]),
    activity_index:M("人口、POI、建筑、夜光、交通多源活力指数","local-model",["weighted_index"]),
    spatial_grid:M("H3分层网格聚合","kaggle-cpu",["h3_grid","polygon_to_cells","cell_aggregation"],["h3","shapely","pyproj"]),
    spatial_network:M("道路网络、等时圈、最短路、中心性","kaggle-cpu",["isochrone","shortest_path","network_accessibility"],["networkx","shapely","pyproj"]),
    temporal_activity:M("区域活动趋势、变点、季节性","kaggle-cpu",["trend","seasonality","change_point"],["numpy","scipy","statsmodels"]),
    calibration:M("真实客流样本校准","deferred-benchmark-library",["calibrate_footfall","backtest"],["scikit-learn","statsmodels"],"按用户要求暂不执行；以后网络真实样本进入基准库后启用")
  }),
  finance_investment:DOMAIN("金融投资",{
    portfolio:M("资产配置","kaggle-cpu",["mean_variance","min_volatility","max_sharpe","black_litterman","hrp","cvar"],["numpy","scipy","cvxpy","pypfopt"]),
    risk:M("市场风险与尾部风险","kaggle-cpu",["var","expected_shortfall","drawdown","stress_test","scenario_pnl"],["numpy","scipy","pandas"]),
    volatility:M("波动率与异方差","kaggle-cpu",["arch","garch","egarch"],["arch","statsmodels"]),
    time_series:M("金融时间序列","kaggle-cpu",["arima","sarima","var","vecm","state_space","kalman"],["statsmodels","numpy","scipy"]),
    factors:M("因子与资产定价","kaggle-cpu",["ols_factor","fama_macbeth","pca_factor","rolling_beta"],["statsmodels","scikit-learn"]),
    relative_value:M("协整、配对、均值回归","kaggle-cpu",["cointegration","pairs_zscore","half_life"],["statsmodels","numpy"]),
    derivatives:M("衍生品定价与敏感度","local-or-wolfram",["black_scholes","binomial","greeks","breakeven"],["scipy"]),
    monte_carlo:M("随机路径与压力模拟","kaggle-cpu",["gbm","bootstrap","scenario_simulation"],["numpy","scipy"])
  }),
  business_management:DOMAIN("商业经营",{
    unit_economics:M("单店/项目经营测算","local-model",["break_even","expected_value","weighted_index"]),
    demand:M("需求预测","kaggle-cpu",["regression","arima","ets","state_space","gradient_boosting"],["statsmodels","scikit-learn"]),
    pricing:M("价格与弹性","kaggle-cpu",["elasticity","logit_demand","price_optimization"],["statsmodels","scipy"]),
    customer:M("客户价值与流失","kaggle-cpu",["clv","cohort_retention","churn","survival"],["scikit-learn","lifelines"]),
    inventory:M("库存与补货","local-or-kaggle",["eoq","newsvendor","safety_stock","reorder_point"],["scipy"]),
    queueing:M("排队与服务能力","local-model",["mm1_queue"]),
    segmentation:M("客户/门店分群","kaggle-cpu",["kmeans","gmm","hierarchical","pca"],["scikit-learn","scipy"]),
    experimentation:M("A/B测试与实验分析","kaggle-cpu",["difference_in_means","proportion_test","bootstrap","uplift"],["scipy","statsmodels","scikit-learn"])
  }),
  intelligence_analysis:DOMAIN("情报分析",{
    evidence_fusion:M("多源证据融合","local-model",["bayesian_evidence_fusion","weighted_index"]),
    hypotheses:M("竞争性假设与情景评分","local-model",["weighted_decision","expected_value"]),
    link_analysis:M("实体关系图谱分析","local-model",["pagerank"],["networkx"]),
    anomaly:M("异常、突变、离群","kaggle-cpu",["zscore","isolation_forest","lof","change_point"],["scikit-learn","scipy"]),
    causal_root_cause:M("因果根因与反事实","kaggle-cpu",["causal_graph","effect_estimation","refutation","root_cause"],["dowhy","networkx","scikit-learn"]),
    bayesian_network:M("贝叶斯网络与情景推演","kaggle-cpu",["bayesian_network","belief_update"],["pgmpy","networkx"]),
    uncertainty:M("信息不确定性","local-model",["entropy","bayesian_evidence_fusion"]),
    scenario:M("场景树和预期损益","local-model",["expected_value","markov_chain"])
  }),
  social_behavior_psychology:DOMAIN("社会行为与群体心理",{
    agent_based:M("个体规则到群体现象","kaggle-cpu",["agent_based_simulation","wealth_exchange","consumer_agents"],["mesa","numpy"]),
    diffusion:M("传播与扩散","local-model",["threshold_diffusion"],["networkx"]),
    opinion:M("观点与社会影响","kaggle-cpu",["deffuant","hegselmann_krause","voter_model","majority_model"],["numpy","networkx"]),
    contagion:M("信息/行为传播","kaggle-cpu",["sir","seir","independent_cascade","linear_threshold"],["networkx","numpy"]),
    discrete_choice:M("选择行为","kaggle-cpu",["multinomial_logit","binary_logit","choice_elasticity"],["statsmodels","scipy"]),
    prospect:M("前景理论价值函数","local-model",["prospect_value"]),
    segregation:M("空间分异与聚集","kaggle-cpu",["schelling"],["mesa","numpy"]),
    survey_latent:M("潜变量、因子、量表结构","kaggle-cpu",["factor_analysis","pca","reliability"],["scikit-learn","statsmodels"])
  }),
  policy_economics:DOMAIN("政策与经济",{
    econometrics:M("计量经济","kaggle-cpu",["ols","glm","panel","gmm","mixed_effects"],["statsmodels"]),
    causal_policy:M("政策效果识别","kaggle-cpu",["difference_in_differences","instrumental_variables","regression_discontinuity","synthetic_control"],["statsmodels","dowhy"]),
    macro:M("宏观动态","kaggle-cpu",["var","vecm","state_space","impulse_response"],["statsmodels"]),
    input_output:M("投入产出与产业关联","kaggle-cpu",["leontief","multiplier","sector_shock"],["numpy","scipy"]),
    game_theory:M("策略互动","local-or-kaggle",["payoff_matrix","mixed_strategy","replicator_dynamics"],["numpy","scipy"]),
    policy_scenario:M("政策情景与敏感性","kaggle-cpu",["scenario_analysis","monte_carlo","sobol","morris"],["numpy","SALib"])
  }),
  operations_supply_chain:DOMAIN("运营与供应链",{
    linear_optimization:M("线性/整数规划","kaggle-cpu",["lp","milp","assignment","knapsack"],["ortools","cvxpy"]),
    routing:M("路径与车辆调度","kaggle-cpu",["shortest_path","vrp","tsp","pickup_delivery"],["ortools","networkx"]),
    scheduling:M("排程","kaggle-cpu",["job_shop","shift_scheduling","resource_allocation"],["ortools"]),
    facility:M("设施选址","kaggle-cpu",["p_median","facility_location","coverage"],["ortools","scipy"]),
    flow:M("网络流","kaggle-cpu",["max_flow","min_cost_flow","transportation"],["ortools","networkx"]),
    discrete_event:M("离散事件模拟","kaggle-cpu",["queue_network","capacity_simulation","process_simulation"],["simpy","numpy"])
  }),
  marketing_growth:DOMAIN("营销与增长",{
    marketing_mix:M("营销组合","kaggle-cpu",["mmm_regression","adstock","saturation"],["statsmodels","scipy"]),
    attribution:M("触点归因","local-or-kaggle",["markov_attribution","shapley_attribution"],["numpy"]),
    diffusion:M("新品扩散","kaggle-cpu",["bass_diffusion","growth_curve"],["scipy"]),
    uplift:M("增量响应","kaggle-cpu",["uplift_model","treatment_effect"],["scikit-learn","dowhy"]),
    funnel:M("漏斗与转化","local-model",["markov_chain","weighted_index"])
  }),
  risk_reliability:DOMAIN("风险、可靠性与敏感性",{
    sensitivity:M("全局敏感性","kaggle-cpu",["sobol","morris","fast"],["SALib","numpy"]),
    reliability:M("可靠性与寿命","kaggle-cpu",["weibull","survival","hazard","reliability_curve"],["scipy","lifelines"]),
    fault_tree:M("故障树与事件树","local-or-kaggle",["fault_tree","event_tree","expected_value"],["networkx"]),
    stochastic:M("随机风险","kaggle-cpu",["monte_carlo","latin_hypercube","bootstrap"],["numpy","scipy"]),
    extreme:M("极值与尾部","kaggle-cpu",["gev","gpd","return_level"],["scipy","statsmodels"])
  }),
  real_estate_urban:DOMAIN("房地产与城市",{
    valuation:M("估值与价格解释","kaggle-cpu",["hedonic_regression","repeat_sales","comparable_adjustment"],["statsmodels","scikit-learn"]),
    site_selection:M("选址与商业圈","local-model",["three_ring_trade_area","huff_trade_area","gravity_od","weighted_index"]),
    urban_growth:M("城市增长与空间演化","kaggle-cpu",["cellular_automata","land_use_transition","spatial_growth"],["numpy","scipy","shapely"])
  }),
  transport_mobility:DOMAIN("交通与流动",{
    trip_distribution:M("出行分布","local-model",["gravity_od"]),
    mode_choice:M("交通方式选择","kaggle-cpu",["multinomial_logit","nested_logit"],["statsmodels","scipy"]),
    network:M("网络分配与可达性","kaggle-cpu",["shortest_path","centrality","accessibility"],["networkx","scipy"]),
    queueing:M("交通/服务排队","local-model",["mm1_queue"])
  }),
  energy_environment:DOMAIN("能源与环境",{
    load_forecast:M("负荷与需求预测","kaggle-cpu",["arima","state_space","gradient_boosting"],["statsmodels","scikit-learn"]),
    dispatch:M("能源调度","kaggle-cpu",["economic_dispatch","capacity_allocation"],["cvxpy","ortools"]),
    environmental_risk:M("环境暴露与风险","kaggle-cpu",["spatial_regression","scenario_analysis","monte_carlo"],["statsmodels","numpy"])
  }),
  public_health:DOMAIN("公共健康与流行病",{
    epidemic:M("群体传播模型","kaggle-cpu",["sir","seir","network_epidemic"],["numpy","scipy","networkx"]),
    survival:M("生存/持续时间","kaggle-cpu",["kaplan_meier","cox","aft"],["lifelines","statsmodels"]),
    health_economics:M("成本效果情景","local-or-kaggle",["expected_value","markov_chain","monte_carlo"],["numpy","scipy"])
  })
});

export const PACKAGE_STACKS=Object.freeze({
  core:["numpy","scipy","pandas","scikit-learn","statsmodels"],
  optimization:["cvxpy","ortools"],
  finance:["pypfopt","arch"],
  causal_bayesian:["dowhy","pgmpy"],
  simulation_network:["mesa","simpy","networkx"],
  geospatial:["h3","shapely","pyproj"],
  sensitivity_survival:["SALib","lifelines"]
});

export function registrySummary(){
  const domains=Object.entries(MODEL_REGISTRY).map(([id,d])=>({id,label:d.label,model_groups:Object.keys(d.models).length}));
  const model_groups=domains.reduce((s,x)=>s+x.model_groups,0);
  return{domains,domain_count:domains.length,model_groups,package_stacks:PACKAGE_STACKS,calibration_state:"deferred-until-benchmark-library",arbitrary_code:false};
}
export function domainModels(id){const d=MODEL_REGISTRY[id];return d?{id,label:d.label,models:d.models}:null}
export function allModelIds(){const out=[];for(const [domain,d] of Object.entries(MODEL_REGISTRY))for(const [group,g] of Object.entries(d.models))for(const method of g.methods)out.push(`${domain}.${group}.${method}`);return out}
