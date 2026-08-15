const VERSION="2026-08-15.1";
const MAX_CHECKS=100;
const ALLOWED_REFERENCE_ORIGINS=new Set(["intelligence_center","governance_snapshot","theory_invariant","historical_holdout","official_reference","synthetic_sanity"]);
const FORBIDDEN_REFERENCE_ORIGINS=new Set(["task_output","current_result","user_goal","desired_outcome","model_prediction"]);
const ALLOWED_CLASSES=new Set(["empirical_anchor","theory_invariant","historical_backtest","stress_scenario","counterexample","tolerance_band"]);
const ALLOWED_PARTITIONS=new Set(["calibration","validation","stress","sanity"]);
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const clamp=(v,min,max,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):d};
const text=(v,n=160)=>String(v??"").trim().slice(0,n);
function err(message,status=400,details){throw Object.assign(new Error(message),{status,details})}

const P=(label,metric_families,required_classes,notes="")=>Object.freeze({label,metric_families:Object.freeze(metric_families),required_classes:Object.freeze(required_classes),notes});
export const BENCHMARK_PACKS=Object.freeze({
  commercial_real_estate:P("商业地产/商圈",["population-catchment","poi-density-mix","accessibility","footfall-proxy","rent-sales-yield","competitor-diversion"],["empirical_anchor","historical_backtest","stress_scenario","tolerance_band"],"真实LBS未授权时不得把开放位置代理量伪装为真实客流"),
  retail_consumer:P("零售/消费",["demand","conversion","basket-size","price-elasticity","inventory-turnover","retention"],["empirical_anchor","historical_backtest","counterexample","stress_scenario","tolerance_band"]),
  banking_finance:P("银行/金融/投资",["return","volatility","drawdown","var-es","default-loss","liquidity","forecast-error"],["theory_invariant","historical_backtest","stress_scenario","counterexample","tolerance_band"]),
  insurance:P("保险/精算",["frequency","severity","loss-ratio","survival","tail-loss","reserve-error"],["empirical_anchor","historical_backtest","stress_scenario","tolerance_band"]),
  manufacturing:P("制造/质量/设备",["yield","defect-rate","throughput","cycle-time","downtime","reliability"],["theory_invariant","empirical_anchor","historical_backtest","stress_scenario","tolerance_band"]),
  logistics_supply_chain:P("物流/供应链",["service-level","lead-time","fill-rate","inventory","route-cost","capacity"],["theory_invariant","historical_backtest","stress_scenario","counterexample","tolerance_band"]),
  energy_utilities:P("能源/公用事业",["load","generation","dispatch-cost","availability","extreme-demand","forecast-error"],["theory_invariant","historical_backtest","stress_scenario","tolerance_band"]),
  agriculture_food:P("农业/食品",["yield","weather-sensitivity","price","inventory","spoilage","supply-risk"],["empirical_anchor","historical_backtest","stress_scenario","tolerance_band"]),
  tourism_hospitality:P("旅游/酒店",["occupancy","adr","revpar","seasonality","accessibility","demand"],["empirical_anchor","historical_backtest","stress_scenario","tolerance_band"]),
  healthcare_public_health:P("医疗/公共健康",["incidence","prevalence","queue-time","survival","resource-use","calibration","coverage"],["theory_invariant","empirical_anchor","historical_backtest","stress_scenario","tolerance_band"],"仅作分析校准；临床用途须另行验证"),
  public_policy:P("政策/公共治理",["baseline-trend","treatment-effect","counterfactual-fit","distributional-impact","budget","uncertainty"],["empirical_anchor","historical_backtest","counterexample","stress_scenario","tolerance_band"]),
  intelligence:P("情报/态势研判",["source-agreement","base-rate","false-positive","false-negative","calibration","scenario-coverage"],["empirical_anchor","counterexample","stress_scenario","tolerance_band"]),
  social_research:P("社会行为/群体心理",["base-rate","choice-share","survey-fit","diffusion","heterogeneity","out-of-sample-error"],["empirical_anchor","historical_backtest","counterexample","tolerance_band"]),
  media_platform:P("媒体/平台/注意力",["reach","engagement","retention","diffusion","attribution","change-point"],["empirical_anchor","historical_backtest","counterexample","stress_scenario","tolerance_band"]),
  legal_regulatory:P("法律/监管/合规",["base-rate","evidence-consistency","classification-error","false-positive","false-negative","scenario-coverage"],["theory_invariant","empirical_anchor","counterexample","tolerance_band"],"法律事实与效力基准必须来自可追溯权威来源"),
  project_management:P("项目管理/工程",["duration","critical-path","cost","capacity","schedule-risk","completion-probability"],["theory_invariant","historical_backtest","stress_scenario","tolerance_band"]),
  labor_demography:P("人口/就业/劳动力",["population","employment","wage","participation","migration","forecast-error"],["empirical_anchor","historical_backtest","stress_scenario","tolerance_band"]),
  cyber_resilience_defensive:P("网络与系统韧性（防御）",["availability","mtbf","mttr","failure-rate","recovery","stress-capacity"],["theory_invariant","historical_backtest","stress_scenario","counterexample","tolerance_band"],"仅用于防御性可靠性与韧性评估")
});

export const UNIVERSAL_GUARDRAILS=Object.freeze([
  {id:"finite-output",class:"theory_invariant",rule:"all numeric outputs used for decisions must be finite",severity:"hard"},
  {id:"probability-domain",class:"theory_invariant",rule:"probabilities must remain within [0,1]",severity:"hard"},
  {id:"nonnegative-physical-quantity",class:"theory_invariant",rule:"quantities declared nonnegative cannot be negative",severity:"hard"},
  {id:"unit-consistency",class:"theory_invariant",rule:"compared values must share compatible units and scaling",severity:"hard"},
  {id:"time-order",class:"theory_invariant",rule:"training/calibration data cannot use observations later than the evaluation cutoff",severity:"hard"},
  {id:"geography-consistency",class:"theory_invariant",rule:"reference geography must match or be explicitly transformed to the target geography",severity:"hard"},
  {id:"holdout-separation",class:"theory_invariant",rule:"validation references must not be used to fit model parameters",severity:"hard"},
  {id:"uncertainty-visible",class:"tolerance_band",rule:"material uncertainty must be reported instead of collapsed to a false point certainty",severity:"soft"}
]);

const RISK=Object.freeze({
  low:{validation_share:0.20,min_validation_checks:1,stress_required:false,counterexample_required:false},
  medium:{validation_share:0.30,min_validation_checks:2,stress_required:true,counterexample_required:false},
  high:{validation_share:0.40,min_validation_checks:3,stress_required:true,counterexample_required:true},
  critical:{validation_share:0.50,min_validation_checks:4,stress_required:true,counterexample_required:true}
});

export function benchmarkMeta(){return{version:VERSION,pack_count:Object.keys(BENCHMARK_PACKS).length,benchmark_classes:[...ALLOWED_CLASSES],reference_origins:[...ALLOWED_REFERENCE_ORIGINS],partitions:[...ALLOWED_PARTITIONS],universal_guardrails:UNIVERSAL_GUARDRAILS,risk_profiles:RISK,principles:{goal_separation:true,read_only:true,no_task_result_as_truth:true,holdout_required:true,fail_closed_on_hard_invariants:true,uncertainty_preserved:true,network:false}}}
export function benchmarkPack(id){const p=BENCHMARK_PACKS[id];return p?{id,...p}:null}
export function benchmarkPacks(){return Object.entries(BENCHMARK_PACKS).map(([id,p])=>({id,...p}))}

export function benchmarkPlan(input={}){
  const industry=text(input.industry||input.domain,80);if(!BENCHMARK_PACKS[industry])err("BENCHMARK_PACK_NOT_FOUND",404,{industry,allowed:Object.keys(BENCHMARK_PACKS)});
  const risk=text(input.risk_level||"medium",20).toLowerCase();if(!RISK[risk])err("INVALID_RISK_LEVEL",400,{allowed:Object.keys(RISK)});
  const pack=BENCHMARK_PACKS[industry],r=RISK[risk];
  return{version:VERSION,industry,risk_level:risk,objective_separated_from_truth:true,pack:{id:industry,...pack},required:{classes:[...new Set(["theory_invariant",...pack.required_classes])],validation_share_min:r.validation_share,validation_checks_min:r.min_validation_checks,stress_required:r.stress_required,counterexample_required:r.counterexample_required,universal_guardrails:UNIVERSAL_GUARDRAILS.map(x=>x.id)},workflow:["freeze-reference-pack","split-calibration-vs-validation","preflight-units-time-geography","fit-or-run-model","evaluate-holdout","run-stress-and-counterexamples","score-drift-and-tolerance","accept-warn-or-fail-closed"],acceptance:{green:"all hard invariants pass; normalized errors <=1; validation present",yellow:"no hard failure; at least one normalized error in (1,2] or validation coverage weak",red:"hard invariant failed; normalized error >2; forbidden reference origin; or required validation absent"}};
}

function validateOrigin(origin){const o=text(origin,40).toLowerCase();if(FORBIDDEN_REFERENCE_ORIGINS.has(o))err("REFERENCE_ORIGIN_FORBIDDEN",400,{origin:o});if(!ALLOWED_REFERENCE_ORIGINS.has(o))err("REFERENCE_ORIGIN_NOT_APPROVED",400,{origin:o,allowed:[...ALLOWED_REFERENCE_ORIGINS]});return o}
function validateClass(v){const c=text(v,40);if(!ALLOWED_CLASSES.has(c))err("INVALID_BENCHMARK_CLASS",400,{class:c,allowed:[...ALLOWED_CLASSES]});return c}
function validatePartition(v){const p=text(v||"validation",20).toLowerCase();if(!ALLOWED_PARTITIONS.has(p))err("INVALID_BENCHMARK_PARTITION",400,{partition:p,allowed:[...ALLOWED_PARTITIONS]});return p}
function requireFinite(v,name){if(!finite(v))err("INVALID_NUMERIC_VALUE",400,{field:name});return v}

export function validateReferencePack(pack={}){
  if(!pack||typeof pack!=="object"||Array.isArray(pack))err("INVALID_REFERENCE_PACK");
  const id=text(pack.id,100);if(!id)err("REFERENCE_PACK_ID_REQUIRED");
  const version=text(pack.version,80);if(!version)err("REFERENCE_PACK_VERSION_REQUIRED");
  const source=text(pack.source,160);if(!source)err("REFERENCE_PACK_SOURCE_REQUIRED");
  const origin=validateOrigin(pack.origin);
  const digest=text(pack.digest_sha256,64).toLowerCase();if(!/^[a-f0-9]{64}$/.test(digest))err("REFERENCE_PACK_DIGEST_REQUIRED",400,{format:"sha256-hex"});
  const observedAt=text(pack.observed_at,40);if(!observedAt||Number.isNaN(Date.parse(observedAt)))err("REFERENCE_PACK_OBSERVED_AT_REQUIRED");
  const rows=Number(pack.record_count);if(!Number.isInteger(rows)||rows<1||rows>1000000000)err("INVALID_REFERENCE_PACK_RECORD_COUNT");
  return{ok:true,id,version,source,origin,digest_sha256:digest,observed_at:new Date(observedAt).toISOString(),record_count:rows,immutable:true,task_writable:false};
}

function scorePoint(c){const value=requireFinite(c.value,"value"),reference=requireFinite(c.reference,"reference"),absTol=Math.max(0,clamp(c.tolerance_abs,0,Number.MAX_SAFE_INTEGER,0)),relTol=Math.max(0,clamp(c.tolerance_rel,0,10,0)),den=Math.max(absTol,Math.abs(reference)*relTol,Number.EPSILON),error=Math.abs(value-reference),normalized=error/den;return{value,reference,error,normalized_error:normalized,tolerance_abs:absTol,tolerance_rel:relTol,status:normalized<=1?"pass":normalized<=2?"warn":"fail"}}
function scoreRange(c){const value=requireFinite(c.value,"value"),min=requireFinite(c.min,"min"),max=requireFinite(c.max,"max");if(min>max)err("INVALID_BENCHMARK_RANGE");const width=Math.max(max-min,Math.abs(max)*0.01,1e-12),distance=value<min?min-value:value>max?value-max:0,normalized=distance/width;return{value,min,max,distance,normalized_error:normalized,status:distance===0?"pass":normalized<=0.25?"warn":"fail"}}
function scoreInvariant(c){const passed=c.passed===true;return{passed,normalized_error:passed?0:Infinity,status:passed?"pass":"fail",hard:c.hard!==false}}
function scoreCoverage(c){const observed=requireFinite(c.observed,"observed"),target=requireFinite(c.target,"target"),tol=Math.max(0.001,clamp(c.tolerance,0.001,1,0.05)),error=Math.abs(observed-target),normalized=error/tol;return{observed,target,error,normalized_error:normalized,status:normalized<=1?"pass":normalized<=2?"warn":"fail"}}

export function evaluateBenchmarks(input={}){
  const risk=text(input.risk_level||"medium",20).toLowerCase();if(!RISK[risk])err("INVALID_RISK_LEVEL",400,{allowed:Object.keys(RISK)});
  const checks=Array.isArray(input.checks)?input.checks:[];if(!checks.length)err("BENCHMARK_CHECKS_REQUIRED");if(checks.length>MAX_CHECKS)err("TOO_MANY_BENCHMARK_CHECKS",413,{max:MAX_CHECKS});
  const results=[];let hardFail=false,warns=0,fails=0,validation=0,stress=0,counterexamples=0;
  for(let i=0;i<checks.length;i++){
    const c=checks[i]||{},id=text(c.id||`check-${i+1}`,100),klass=validateClass(c.class),partition=validatePartition(c.partition),origin=validateOrigin(c.reference_origin),kind=text(c.kind,30).toLowerCase();
    if(partition==="validation")validation++;if(partition==="stress")stress++;if(klass==="counterexample")counterexamples++;
    let scored;if(kind==="point")scored=scorePoint(c);else if(kind==="range")scored=scoreRange(c);else if(kind==="invariant")scored=scoreInvariant(c);else if(kind==="coverage")scored=scoreCoverage(c);else err("INVALID_BENCHMARK_KIND",400,{kind,allowed:["point","range","invariant","coverage"]});
    if(scored.status==="warn")warns++;if(scored.status==="fail")fails++;if(kind==="invariant"&&scored.status==="fail"&&scored.hard)hardFail=true;
    results.push({id,class:klass,partition,reference_origin:origin,kind,...scored});
  }
  const r=RISK[risk],validationWeak=validation<r.min_validation_checks,stressMissing=r.stress_required&&stress<1,counterexampleMissing=r.counterexample_required&&counterexamples<1;
  let state="green";const reasons=[];
  if(hardFail||fails>0||validationWeak||stressMissing||counterexampleMissing){state="red";if(hardFail)reasons.push("hard-invariant-failed");if(fails)reasons.push("benchmark-failure");if(validationWeak)reasons.push("validation-insufficient");if(stressMissing)reasons.push("stress-check-required");if(counterexampleMissing)reasons.push("counterexample-required")}
  else if(warns>0){state="yellow";reasons.push("tolerance-warning")}
  return{ok:state!=="red",version:VERSION,state,risk_level:risk,summary:{checks:results.length,pass:results.filter(x=>x.status==="pass").length,warn:warns,fail:fails,validation_checks:validation,stress_checks:stress,counterexample_checks:counterexamples},reasons,action:state==="green"?"accept-with-reported-uncertainty":state==="yellow"?"recalibrate-or-cross-validate":"fail-closed-recompute-or-refresh-reference",results};
}
