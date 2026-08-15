export const MEDICAL_IMAGING_TOOLKIT=Object.freeze({
  id:"monai-medical-imaging",
  framework:"MONAI",
  target_version:"1.6.0",
  license:"Apache-2.0",
  upstream:"Project-MONAI/MONAI",
  role:"medical-imaging-ai-research-and-clinical-decision-support-toolkit",
  components:["MONAI Core","MONAI Label","MONAI Deploy"],
  formats:["DICOM","NIfTI"],
  runtime_packages:["torch","monai","pydicom","nibabel","SimpleITK"],
  execution_backend:"Kaggle controlled Python runtime",
  runtime_install:false,
  runtime_network:false,
  availability_gate:"all required packages must pass the existing Kaggle import audit before production use",
  clinical_boundary:"research and clinician decision support only; no autonomous diagnosis, treatment order, or unsupervised patient-specific medical decision",
  data_boundary:"patient images must enter through a separately governed de-identified/private data path; never commit patient images or identifiers to GitHub",
  evidence_boundary:"BioMCP and biomedical databases belong to the intelligence/evidence layer; MONAI belongs to compute and does not replace evidence retrieval"
});
export function medicalImagingMeta(){return{...MEDICAL_IMAGING_TOOLKIT,registered:true,production_ready:"runtime-audit-required"}}
