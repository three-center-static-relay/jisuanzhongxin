# Medical imaging toolkit

## Selected framework

- Framework: **MONAI**
- Target release: **1.6.0**
- Upstream: `Project-MONAI/MONAI`
- License: Apache-2.0
- Role: medical-imaging AI research and clinician decision-support computation.

## Runtime stack

The controlled Kaggle runtime audits these packages before medical-imaging use:

- `torch`
- `monai`
- `pydicom`
- `nibabel`
- `SimpleITK`

No runtime `pip install` is allowed and Kaggle Internet remains disabled. A package being registered here does not mean it is installed in the current Kaggle image. Production availability requires a real import audit.

## `medical-imaging` request profile

A request using `profile: "medical-imaging"` is normalized at the production entry into the existing bounded Kaggle execution path and receives `input.medical_imaging_toolkit=true`. The first execution is a synthetic-data preflight. It imports the medical stack and, when the required packages are present, performs a tiny MONAI 3D UNet forward pass. It uses no patient data and no network.

The preflight returns `medical_imaging_ready`. A false value is a hard runtime capability warning: the system must not claim MONAI patient-image analysis is available.

## Clinical and data boundaries

MONAI is a computation toolkit, not an evidence source and not an autonomous clinician. BioMCP, PubMed/PMC, ClinicalTrials.gov and biomedical databases remain in the intelligence/evidence layer. Patient-specific images require a separate private, de-identified, access-controlled data path. Raw patient images, identifiers, clinical notes or DICOM identifiers must never be committed to GitHub.

No autonomous diagnosis, treatment order or unsupervised patient-specific clinical decision is permitted. Any patient-specific output is decision support requiring qualified human review and validation appropriate to the use case.
