import assert from "node:assert/strict";
const BASE="https://compute-worker.a15280020511.workers.dev";
const img=await fetch(`${BASE}/v1/toolkits/medical-imaging/meta`,{headers:{accept:"application/json"}});const im=await img.json().catch(()=>null);
assert.equal(img.status,200,`IMAGING_META_HTTP_${img.status}:${JSON.stringify(im)}`);assert.equal(im?.ok,true);assert.equal(im?.framework,"MONAI");assert.equal(im?.target_version,"1.6.0");assert.equal(im?.gpu_optional,true);
for(const p of ["torch","monai","pydicom","nibabel","SimpleITK"])assert.ok(im?.runtime_packages?.includes(p),`MISSING_${p}`);
const k=await fetch(`${BASE}/v1/providers/kaggle/health`,{headers:{accept:"application/json"}});const kb=await k.json().catch(()=>null);
assert.equal(k.status,200,`KAGGLE_HEALTH_HTTP_${k.status}:${JSON.stringify(kb)}`);assert.equal(kb?.ok,true);assert.equal(kb?.authenticated,true);assert.equal(kb?.route_eligible,true);
const h=await fetch(`${BASE}/health`,{headers:{accept:"application/json"}});const hb=await h.json().catch(()=>null);assert.equal(h.status,200);assert.equal(hb?.ok,true);
console.log(JSON.stringify({ok:true,suite:"medical-compute-fresh-only",framework:im.framework,target_version:im.target_version,kaggle_authenticated:kb.authenticated,kaggle_route_eligible:kb.route_eligible,kaggle_acceptance_state:kb.acceptance_state,gpu_job_started:false,patient_data_used:false}));