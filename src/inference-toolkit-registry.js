export const INFERENCE_TOOLKIT_VERSION="sparse-hidden-inference-v2-20260817";

export const INFERENCE_TOOLKIT=Object.freeze({
  version:INFERENCE_TOOLKIT_VERSION,
  purpose:"Strengthen bounded inference when observations are missing, noisy, fragmented or only indirectly visible in public evidence, with explicit commercial-spatial support.",
  immediate_runtime:{
    sklearn_iterative_imputer:{package:"scikit-learn",role:"multivariate-multiple-imputation",status:"usable-in-current-kaggle-stack",outputs:["imputed-estimates","posterior-spread","missingness-indicators"]},
    sklearn_knn_imputer:{package:"scikit-learn",role:"local-neighborhood-imputation",status:"usable-in-current-kaggle-stack"},
    numpy_low_rank_completion:{package:"numpy",role:"matrix-completion-latent-factor-reconstruction",status:"usable-in-current-kaggle-stack"},
    sklearn_anomaly_ensemble:{package:"scikit-learn",role:"isolation-forest-lof-robust-z-consensus",status:"usable-in-current-kaggle-stack"},
    networkx_link_prediction:{package:"networkx",role:"candidate-hidden-relationship-discovery",status:"usable-in-current-kaggle-stack"},
    numpy_latent_factor:{package:"numpy",role:"latent-signal-factor-discovery",status:"usable-in-current-kaggle-stack"},
    sklearn_gaussian_process:{package:"scikit-learn",role:"spatial-gap-interpolation-with-predictive-standard-deviation",status:"usable-in-current-kaggle-stack"},
    numpy_gravity_ipf:{package:"numpy",role:"doubly-constrained-synthetic-origin-destination-estimation",status:"usable-in-current-kaggle-stack"},
    numpy_huff_trade_area:{package:"numpy",role:"probabilistic-trade-area-capture-and-competitor-overlap-proxy",status:"usable-in-current-kaggle-stack"},
    sklearn_random_forest_nowcast:{package:"scikit-learn",role:"public-anchor-footfall-and-dwell-proxy-nowcast-with-ensemble-spread",status:"usable-in-current-kaggle-stack"}
  },
  next_runtime_candidates:{
    pymc:{role:"hierarchical-bayesian-latent-variable-partial-pooling-posterior-predictive-spatiotemporal-models",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    tensorly:{role:"masked-tensor-decomposition-and-multiway-completion",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    causal_learn:{role:"causal-structure-discovery-pc-fci-ges-lingam-missingness-aware",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    splink:{role:"probabilistic-entity-resolution-across-fragmented-public-sources",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    pysal:{role:"spatial-weights-esda-moran-lisa-spatial-lag-spatial-error-and-spatial-econometrics",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    gstools:{role:"geostatistics-variograms-kriging-random-fields-spatial-uncertainty",priority:"P0",status:"candidate-requires-runtime-pin-and-package-audit"},
    pykrige:{role:"ordinary-universal-regression-kriging-for-spatial-gaps",priority:"P1",status:"candidate-requires-runtime-pin-and-package-audit"},
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
    mnar_rule:"When missingness may be MNAR, report sensitivity/scenario bands rather than a single confident completion.",
    spatial_rule:"Modelled footfall, dwell, origin-destination, trade-area overlap and aggregate profiles remain inferred or derived unless backed by an independently approved observed source."
  },
  recommended_pipeline:[
    "entity-resolution",
    "missingness-profile",
    "multiple-imputation",
    "spatial-gap-interpolation",
    "low-rank-or-tensor-completion",
    "latent-factor-discovery",
    "anomaly-and-change-point-detection",
    "synthetic-origin-destination",
    "probabilistic-trade-area-and-overlap",
    "public-anchor-footfall-and-dwell-nowcast",
    "candidate-link-or-causal-structure-discovery",
    "scenario-sensitivity",
    "posterior-or-ensemble-uncertainty",
    "holdout-and-geography-transfer-validation",
    "evidence-labelled-output"
  ]
});

export function inferenceToolkitManifest(){return INFERENCE_TOOLKIT;}
