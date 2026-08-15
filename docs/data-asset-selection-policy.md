# Compute-center data asset and template selection policy

## Goal

The compute center is a network-denied execution environment. It must not become a raw mirror of Kaggle, Hugging Face, government portals, research repositories, or library-bundled example datasets. Discovery and retrieval belong to the intelligence center. The compute center receives only bounded, validated, immutable task packs.

## Asset classes

### 1. Embedded reference datasets
Datasets or examples bundled with installed scientific libraries, tutorials, sample notebooks, graph generators, solver examples, simulation examples, and toy datasets.

Allowed uses:
- unit and smoke tests;
- algorithm correctness checks;
- numerical regression tests;
- performance benchmarks;
- validating a new model/solver pipeline;
- demonstrating a template when no real decision is being made.

Default prohibition:
- never treat an embedded/toy/example dataset as evidence about a real person, city, company, market, policy, or current event unless its external provenance independently qualifies it as an approved real dataset.

### 2. Standard benchmark datasets
Curated benchmark sets from OpenML, UCI, Kaggle competitions, Hugging Face benchmark repositories, research benchmarks, or frozen public challenge datasets.

Uses:
- compare algorithms;
- champion/challenger selection;
- detect regressions after dependency upgrades;
- measure CPU/GPU speedup;
- assess stability, calibration, uncertainty and out-of-sample performance.

Benchmarks do not automatically become task evidence.

### 3. Production public datasets
Authoritative or well-documented real-world datasets selected by the intelligence center from official statistics, public agencies, research infrastructures, public-data clouds and reputable research repositories.

These are the preferred evidence inputs for real tasks.

### 4. Synthetic and generator datasets
Synthetic observations produced by statistical generators, simulation models, bootstrapping, scenario generation, graph generators, agent-based models or stress-testing engines.

Uses:
- rare-event stress tests;
- adversarial cases;
- sensitivity analysis;
- Monte Carlo;
- coverage of edge cases not present in historical data.

Synthetic data must always be marked synthetic and may not silently replace missing reality.

### 5. Task-ready immutable data packs
The only dataset class that a normal production task should load directly.

A pack must include:
- `manifest.json`;
- dataset files in approved formats;
- schema and semantic definitions;
- units;
- spatial/temporal coverage;
- provenance and source URLs/identifiers;
- license/terms summary;
- retrieval timestamp;
- quality assessment;
- missing-data notes;
- revision/version identifier when available;
- SHA-256 for every file;
- transformations already applied by the intelligence center;
- explicit statement of whether any field is observed, inferred, modeled or synthetic.

## Template classes

The center should collect reusable templates, but not blindly execute one fixed template for every problem.

1. `problem-spec` — objective, decision variables, constraints, geography, horizon, units, outputs.
2. `data-validation` — schema, missingness, duplicates, outliers, revision checks, source reconciliation.
3. `descriptive-analysis` — distributions, cohort/segment comparison, spatial and temporal summaries.
4. `forecast` — baseline, rolling validation, interval estimation, challenger model.
5. `causal` — identification assumptions, pre-trend/falsification checks, DiD/event study/synthetic control/IV/RD eligibility.
6. `optimization` — objective/constraints, deterministic baseline, robust/stochastic variant, sensitivity.
7. `simulation` — parameter distributions, calibration, random seeds, scenario tree, convergence checks.
8. `spatial` — CRS validation, spatial joins, accessibility, density, network and small-area estimation.
9. `financial` — accounting identities, cash flow, scenario assumptions, NPV/IRR/risk metrics.
10. `commercial-location` — catchment, population, POI, competition, accessibility, demand proxy and stress scenarios.
11. `macro-policy` — official series reconciliation, deflation/seasonality, nowcasting, policy shock scenarios.
12. `risk` — base rates, tails, correlated shocks, stress tests, failure modes and uncertainty budget.

## Selection sequence

### Stage A — classify the task
Assign one or more task types:
- descriptive;
- forecasting;
- causal;
- optimization;
- simulation;
- spatial/GIS;
- network;
- finance;
- policy;
- commercial-location;
- anomaly/risk;
- scientific/engineering.

### Stage B — select data sources
For each candidate dataset, score 0-5 on:
- authority;
- direct relevance;
- geographic fit;
- temporal fit;
- freshness;
- methodology transparency;
- coverage/completeness;
- granularity;
- machine readability;
- reproducibility/versioning;
- license/terms suitability;
- consistency with independent sources.

Hard gates override score:
- unknown/forbidden rights;
- unclear provenance;
- sensitive personal data not explicitly allowed;
- impossible units/schema reconciliation;
- stale beyond task tolerance;
- known leakage into the target variable;
- duplicate copy with worse provenance than an available primary source.

### Stage C — choose the minimum sufficient pack
Do not maximize number of datasets. Select the smallest set that covers:
1. primary ground truth;
2. one independent cross-check where material;
3. one high-frequency or spatial proxy when useful;
4. covariates required by the model;
5. benchmark/reference data needed for validation.

### Stage D — choose templates and methods
Rank templates by task match and data compatibility. Then select candidate models/solvers within that template.

Default policy:
- start with an interpretable baseline;
- add complexity only if out-of-sample evidence improves;
- use multiple eligible models for material decisions;
- use ensembles only when validation supports them;
- require uncertainty estimates for forecasts/simulations;
- require stress testing for optimization/financial/risk decisions.

### Stage E — choose hardware
Use CPU by default. Route to GPU only if expected speedup materially exceeds startup/transfer overhead and the workload is GPU-eligible.

Embedded benchmarks may be used to maintain empirical CPU/GPU crossover thresholds.

## Built-in/library dataset handling

Do collect an inventory of installed-library datasets and examples, but store only metadata/reference information unless redistributable and very small.

Recommended inventory fields:
- package;
- dataset/example name;
- version;
- domain;
- task type;
- size;
- target variable;
- license/provenance;
- loader call;
- intended use (`smoke`, `benchmark`, `template-demo`, `real-evidence-eligible`);
- deterministic hash where bundled;
- known caveats.

Examples of useful categories:
- statsmodels example datasets for econometric implementation tests;
- scikit-learn toy/real-world loaders for ML regression/classification smoke tests if installed;
- NetworkX generators/graph atlas examples for graph algorithms;
- OR-Tools examples for routing/scheduling/assignment/packing validation;
- Mesa/SimPy example models for ABM/discrete-event simulation validation;
- SciPy/NumPy generated numerical cases;
- geospatial sample geometries for Shapely/PyProj validation.

These examples validate machinery. They do not establish reality.

## Dataset platform strategy

Do not mirror whole platforms. Maintain searchable platform registries in the intelligence center for:
- Kaggle;
- Hugging Face Datasets;
- OpenML;
- UCI ML Repository;
- Google BigQuery Public Datasets;
- AWS Open Data;
- Google Dataset Search;
- World Bank Data Catalog;
- IMF Data;
- OECD Data Explorer;
- UN/UN Comtrade;
- WHO/FAO/ILO/BIS/FRED;
- NASA Earthdata;
- Copernicus Data Space;
- NOAA NCEI;
- USGS Science Data Catalog;
- Zenodo;
- Figshare;
- OSF;
- Dataverse network;
- Dryad;
- PANGAEA;
- re3data;
- DataCite;
- domain-specific public repositories.

The intelligence center should query these dynamically using the current problem specification, select candidates, validate them, and freeze only the approved task pack.

## High-end operating pattern

`problem specification -> source discovery -> data quality gate -> immutable task pack -> baseline -> candidate model/solver portfolio -> calibration -> temporal/spatial holdout -> uncertainty -> scenario/stress tree -> robust/stochastic optimization where applicable -> independent challenger -> invariants/sanity checks -> reproducibility receipt`

## Reproducibility receipt

Each run should record:
- task id;
- problem-spec version;
- data-pack hashes;
- template ids/versions;
- code commit/version;
- package/environment fingerprint;
- model/solver names and versions;
- parameters/priors;
- seed(s);
- CPU/GPU runtime profile;
- validation metrics;
- uncertainty metrics;
- scenario ids;
- result hash;
- failure/retry history bounded by policy.

## Non-goals

- Do not hoard public data in the compute repository.
- Do not automatically trust popularity, Kaggle votes, download counts or model leaderboard rank.
- Do not use benchmark accuracy as proof of real-world validity.
- Do not infer finer spatial/temporal precision than source data supports.
- Do not retain task data or task history after the governed lifecycle requires cleanup.
