# Benchmark Guidance System v1

The compute-center benchmark library is a read-only guidance and validation layer. It is not a desired-outcome forcing mechanism.

## Control-loop analogy

A useful analogy is navigation/guidance: the model is the vehicle, the objective function is the destination, evidence is the sensor input, and the benchmark library is the reference/navigation layer that measures drift and decides whether the result is acceptable, needs recalibration, or must fail closed.

The benchmark library must never convert a business/policy/user goal into ground truth. Desired outcomes and reality anchors are separate objects.

## Six benchmark classes

1. `empirical_anchor` — frozen real-world reference observations with provenance.
2. `theory_invariant` — mathematical, logical, unit, probability, accounting, conservation, chronology, and feasibility constraints.
3. `historical_backtest` — out-of-sample historical periods not used to fit the model.
4. `stress_scenario` — adverse, edge, tail, and regime-change scenarios.
5. `counterexample` — known negative cases and failure examples that a robust model must reject or distinguish.
6. `tolerance_band` — explicit acceptable error/coverage bands rather than false exactness.

## Data flow

1. Intelligence Center collects evidence and authoritative reference observations.
2. Governance freezes an immutable reference snapshot/version with provenance and SHA-256 digest.
3. Compute Center reads the frozen reference pack. Tasks cannot write or redefine benchmark truth.
4. Calibration and validation partitions are separated.
5. Model execution occurs.
6. Benchmark guidance evaluates invariants, holdout error, stress behavior, counterexamples, and uncertainty coverage.
7. Result receives one state:
   - Green: accept with uncertainty reported.
   - Yellow: recalibrate, cross-validate, refresh evidence, or use another model.
   - Red: fail closed; do not present the result as production-grade.

## Anti-drift / anti-overfit rules

- `task_output`, `current_result`, `model_prediction`, `user_goal`, and `desired_outcome` are forbidden as reference truth origins.
- Validation references cannot be used for parameter fitting.
- High/critical-risk tasks require stronger validation, stress scenarios, and counterexamples.
- Hard invariants override aggregate score: one hard logical/unit/probability violation is enough to fail.
- Benchmark disagreement is evidence of uncertainty or regime change; it is not automatically corrected toward any preferred source.
- Reference packs are immutable, versioned, source-attributed, time-stamped, and digest-addressed.

## Risk levels

- Low: minimum independent validation; stress optional.
- Medium: stronger holdout plus at least one stress check.
- High: larger validation set, stress check, and counterexample required.
- Critical: strongest holdout ratio, stress/counterexample coverage, and fail-closed behavior.

## Runtime API

Read-only guidance endpoints:

- `GET /v1/benchmarks/meta`
- `GET /v1/benchmarks/packs`
- `GET /v1/benchmarks/pack/:id`
- `POST /v1/benchmarks/plan`
- `POST /v1/benchmarks/evaluate`
- `POST /v1/benchmarks/validate-reference-pack`

There is deliberately no benchmark write endpoint.

## What v1 contains

v1 provides the guidance engine, validation rules, universal guardrails, 18 industry benchmark templates, risk policy, and deterministic regression tests. It does not fabricate empirical truth values. Real-world anchors are added only after authoritative evidence has been collected and frozen as a reference pack.
