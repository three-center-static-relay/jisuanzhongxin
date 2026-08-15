import assert from "node:assert/strict";
import fs from "node:fs";
import {dispatch,officialMeta} from "../src/kaggle-official.js";
import {medicalImagingMeta} from "../src/medical-imaging-toolkit.js";

const meta=medicalImagingMeta();
assert.equal(meta.framework,"MONAI");
assert.equal(meta.target_version,"1.6.0");
assert.equal(meta.runtime_install,false);
assert.equal(meta.runtime_network,false);
for(const p of ["torch","monai","pydicom","nibabel","SimpleITK"])assert.ok(meta.runtime_packages.includes(p));
const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");
assert.ok(entry.includes('profile:"medical-imaging"')||entry.includes('requested_profile:"medical-imaging"'));
assert.ok(entry.includes("medical_imaging_toolkit:true"));

const calls=[];const oldFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,init={})=>{const body=init.body?JSON.parse(init.body):{};calls.push({url:String(url),body});
    if(String(url).includes("IntrospectToken"))return new Response(JSON.stringify({active:true,username:"tester",userId:1,scope:"read write"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("SaveKernel"))return new Response(JSON.stringify({ref:"tester/three-center-medical-preflight",versionNumber:1}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("UNEXPECTED_FETCH:"+url);
  };
  const out=await dispatch({KAGGLE_API_TOKEN:"secret-token"},{task_id:"medical-preflight",profile:"core",input:{medical_imaging_toolkit:true,requested_profile:"medical-imaging"},timeout_seconds:300,gpu:false});
  assert.equal(out.gpu,false);
  const save=calls.find(x=>x.url.includes("SaveKernel"));assert.ok(save);
  assert.equal(save.body.enableInternet,false);assert.equal(save.body.isPrivate,true);
  const script=String(save.body.text||"");
  for(const token of ["MONAI","monai","pydicom","nibabel","SimpleITK","UNet","synthetic_3d_unet","patient_data_used","medical_imaging_ready"])assert.ok(script.includes(token),token);
  assert.equal(script.includes("pip install"),false);assert.equal(script.includes("subprocess"),false);
  const km=officialMeta();assert.equal(km.medical_imaging_preflight,true);assert.deepEqual(km.medical_imaging_package_audit,["torch","monai","pydicom","nibabel","SimpleITK"]);
  console.log(JSON.stringify({ok:true,suite:"medical-imaging-toolkit",framework:"MONAI",target_version:"1.6.0",patient_data_used:false,network:false}));
}finally{globalThis.fetch=oldFetch}
