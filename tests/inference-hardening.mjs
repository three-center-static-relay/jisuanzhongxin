import assert from "node:assert/strict";
import {recipeFor,buildModelRecipeScript,recipeMeta} from "../src/model-recipe-router.js";
import {inferenceToolkitManifest} from "../src/inference-toolkit-registry.js";

const digest="a".repeat(64),source_receipts=[{source:"public-source-a",digest_sha256:digest},{source:"public-source-b",digest_sha256:"b".repeat(64)}];
const matrix=[[1,null,3],[2,5,null],[3,6,9],[4,8,12]];
const methods=["missing_data_imputation","low_rank_completion","latent_signal_inference","anomaly_consensus","relationship_hypothesis"];
for(const method of methods){const id=`intelligence.${method}`;assert.equal(recipeFor(id)?.method,method)}

const impute=buildModelRecipeScript("t-impute","intelligence.missing_data_imputation",{matrix,source_receipts,missingness_mechanism:"MAR",draws:4});
for(const token of ["IterativeImputer","KNNImputer","sample_posterior=True","posterior_std","imputed-values-are-inferred-not-observed","observed_promoted_from_inference"])assert.ok(impute.includes(token),token);
assert.equal(impute.includes("enableInternet"),false);

const lowrank=buildModelRecipeScript("t-lowrank","intelligence.low_rank_completion",{matrix,source_receipts,missingness_mechanism:"MNAR-unknown-or-sensitive",rank:2});
for(const token of ["np.linalg.svd","low-rank latent structure","sensitivity_required","completion-is-inferred-not-observed"])assert.ok(lowrank.includes(token),token);

const latent=buildModelRecipeScript("t-latent","intelligence.latent_signal_inference",{matrix,source_receipts,factors:2});
for(const token of ["explained_variance_ratio","latent-pattern-requires-domain-validation","latent-factors-are-hypotheses-not-observed-causes"])assert.ok(latent.includes(token),token);

const anomaly=buildModelRecipeScript("t-anomaly","intelligence.anomaly_consensus",{matrix,source_receipts});
for(const token of ["IsolationForest","LocalOutlierFactor","robust_z","anomaly-does-not-identify-cause"])assert.ok(anomaly.includes(token),token);

const relationship=buildModelRecipeScript("t-link","intelligence.relationship_hypothesis",{nodes:["mall","brand","developer","parcel"],edges:[{source:"mall",target:"brand"},{source:"mall",target:"developer"},{source:"developer",target:"parcel"}],source_receipts});
for(const token of ["networkx","adamic_adar_index","jaccard_coefficient","candidate-links-are-not-observed-relationships","evidence_kind\":\"hypothesis"])assert.ok(relationship.includes(token),token);

const toolkit=inferenceToolkitManifest();
assert.equal(toolkit.inference_contract.never_promote_inference_to_observed,true);
assert.equal(toolkit.inference_contract.uncertainty_required,true);
for(const k of ["sklearn_iterative_imputer","numpy_low_rank_completion","sklearn_anomaly_ensemble","networkx_link_prediction"])assert.ok(toolkit.immediate_runtime[k]);
for(const k of ["pymc","tensorly","causal_learn","splink","pyod","ruptures","gliner2","snorkel"])assert.ok(toolkit.next_runtime_candidates[k]);
const meta=recipeMeta();
for(const m of methods)assert.ok(meta.methods.includes(m));
assert.equal(meta.enable_internet,false);
assert.equal(meta.arbitrary_code,false);

console.log(JSON.stringify({ok:true,suite:"inference-hardening",methods,immediate_runtime:Object.keys(toolkit.immediate_runtime),candidate_runtime:Object.keys(toolkit.next_runtime_candidates),inference_never_observed:true}));
