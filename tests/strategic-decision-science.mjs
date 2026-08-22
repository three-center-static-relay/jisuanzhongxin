import assert from "node:assert/strict";
import {scoreForecasts,aggregateForecasts,signalDetectionMetrics,robustDecisionAnalysis,assumptionStressTest,decisionScienceMeta} from "../src/strategic-decision-science.js";
const forecasts=scoreForecasts([{probability:.8,outcome:1},{probability:.2,outcome:0},{probability:.6,outcome:1},{probability:.3,outcome:0}]);assert.equal(forecasts.ok,true);assert(forecasts.brier_score<.2);assert(forecasts.calibration_error>=0);
const pooled=aggregateForecasts([.7,.8,.6],[1,2,1]);assert.equal(pooled.ok,true);assert(pooled.weighted_mean>.69&&pooled.weighted_mean<.76);
const sd=signalDetectionMetrics({hits:80,misses:20,false_alarms:10,correct_rejections:90});assert.equal(sd.ok,true);assert(sd.d_prime>1);assert(sd.false_alarm_rate===.1);
const robust=robustDecisionAnalysis([{strategy_id:"A",outcomes:[.8,.7,.6,.5]},{strategy_id:"B",outcomes:[.72,.72,.72,.72]}],.4);assert.equal(robust.ok,true);assert.equal(robust.recommended_strategy,"B");
const stress=assumptionStressTest([{assumption_id:"critical",importance:.95,uncertainty:.9,evidence_gap:.8,reversibility:.1},{assumption_id:"minor",importance:.2,uncertainty:.2,evidence_gap:.1,reversibility:.8}]);assert.equal(stress.assumptions[0].assumption_id,"critical");assert.equal(stress.assumptions[0].action,"TEST_OR_HEDGE_NOW");assert.equal(decisionScienceMeta().decision_support_only,true);
console.log(JSON.stringify({ok:true,suite:"strategic-decision-science",brier:forecasts.brier_score,d_prime:sd.d_prime,recommended:robust.recommended_strategy}));
