import assert from "node:assert/strict";
import {dispatch,officialMeta} from "../src/kaggle-official.js";

const calls=[];const oldFetch=globalThis.fetch;
try{
  globalThis.fetch=async(url,init={})=>{const body=init.body?JSON.parse(init.body):{};calls.push({url:String(url),body});
    if(String(url).includes("IntrospectToken"))return new Response(JSON.stringify({active:true,username:"tester",userId:1,scope:"read write"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("SaveKernel"))return new Response(JSON.stringify({ref:"tester/three-center-cpu-pkg-audit-test",versionNumber:1}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("UNEXPECTED_FETCH:"+url);
  };
  const out=await dispatch({KAGGLE_API_TOKEN:"secret-token"},{task_id:"pkg-audit-test",profile:"core",input:{package_audit:true,seed:7},timeout_seconds:300,gpu:false});
  assert.equal(out.gpu,false);assert.equal(out.machine_shape,"cpu");
  const save=calls.find(x=>x.url.includes("SaveKernel"));assert.ok(save,"missing SaveKernel call");
  assert.equal(save.body.enableInternet,false);assert.equal(save.body.isPrivate,true);assert.equal(save.body.enableGpu,false);
  const script=String(save.body.text||"");
  for(const token of ["package_audit","importlib","numpy","statsmodels","cvxpy","ortools","pypfopt","dowhy","pgmpy","mesa","simpy","networkx","h3","shapely","SALib","lifelines","torch","monai","pydicom","nibabel","SimpleITK","medical_imaging_ready"])assert.ok(script.includes(token),token);
  assert.ok(script.includes("linear_residual"));assert.ok(script.includes("\"accelerator\":\"cpu\""));assert.ok(script.includes("THREE_CENTER_RESULT:"));
  assert.equal(script.includes("pip install"),false);assert.equal(script.includes("subprocess"),false);
  const meta=officialMeta();assert.equal(meta.package_audit,true);assert.equal(meta.package_audit_network,false);assert.equal(meta.arbitrary_code,false);assert.equal(meta.medical_imaging_preflight,true);
  console.log(JSON.stringify({ok:true,suite:"kaggle-package-audit",packages:24,medical_imaging_packages:5,enableInternet:false,arbitrary_code:false}));
}finally{globalThis.fetch=oldFetch}
