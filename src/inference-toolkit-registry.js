export const INFERENCE_TOOLKIT_VERSION="sparse-hidden-inference-v1-20260817";

export const INFERENCE_TOOLKIT=Object.freeze({
  version:INFERENCE_TOOLKIT_VERSION,
  purpose:"Strengthen bounded inference when observations are missing, noisy, fragmented or only indirectly visible in public evidence.",
  immediate_runtime:{
    sklearn_iterative_imputer:{package:"scikit-learn",role:"multivariate-multiple-imputation",status:"usable-in-current-kaggle-stack",outputs:["imputed-estimates","posterior-spread","missingness-indicators"]},
    sklearn_knn_imputer:{package:"scikit-learn",role:"local-neighborhood-imputation",status:"usable-in-current-kaggle-stack"},
    numpy_low_rank_completion:{package:"numpy",role:"matrix-completion-latent-factor-reconstruction",status:"usable-in-current-kaggle-stack"},
    sklearn_anomaly_ensemble:{package:"scikit-learn",role:"isolation-forest-lof-robust-z-consensus",status:"usable-in-current-kaggle-stack"},
    networkx_link_prediction:{package:"networkx",role:"candidate-hidden-relationship-discovery",status:"usable-in-current-kaggle-stack"},
    numpy_latent_factor:{package:"numpy",role:"latent-signal-factor-discovery",status:"usable-in-current-kaggle-stack"}
  },
  next_runtime_candidates:{
    pymc:{role:"hierarchical-bayesian-latent-variable-partial-pooling-posterior-predictive",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    tensorly:{role:"masked-tensor-decomposition-and-multiway-completion",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    causal_learn:{role:"causal-structure-discovery-pc-fci-ges-lingam-missingness-aware",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    splink:{role:"probabilistic-entity-resolution-across-fragmented-public-sources",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    pyod:{role:"broad-anomaly-and-outlier-consensus",priority:"P1",status:"candidate-requires-runtime-pin-and-package-audit"},
    ruptures:{role:"offline-change-point-and-regime-shift-detection",priority:"P1",status:"candidate-requires-runtime-pin-and-package-audit"},
    gliner2:{role:"local-structured-entity-relation-extraction-from-public-text",priority:"P0",status:"candidate-requires-exact-model-card-license-and-runtime-audit"},
    snorkel:{role:"weak-supervision-and-programmatic-label-fusion",priority:"P1",status:"candidate-requires-runtime-pin-and-package-audit"}
  },
  inference_contract:{
    input_evidence_labels:["observed","derived"],
    output_labels:["derived","inferred","hypothesis"],
    never_promote_inference_to_observed:true,
    uncertainty_required:true,
    source_receipts_required_for_business_use:true,
    assumptions_required:true,
    alternative_hypotheses_required_when_material:true,
    missingness_mechanism:["MCAR","MAR","MNAR-unknown-or-sensitive"],
    mnar_rule:"When missingness may be MNAR, report sensitivity/scenario bands rather than a single confident completion."
  },
  recommended_pipeline:[
    "entity-resolution",
    "missingness-profile",
    "multiple-imputation",
    "low-rank-or-tensor-completion",
    "latent-factor-discovery",
    "anomaly-and-change-point-detection",
    "candidate-link-or-causal-structure-discovery",
    "scenario-sensitivity",
    "posterior-or-ensemble-uncertainty",
    "evidence-labelled-output"
  ]
});

export function inferenceToolkitManifest(){return INFERENCE_TOOLKIT;}
