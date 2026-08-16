import production,{CenterGate} from "./production.js";
import {maybeHandleBaiduCircleCI} from "./baidu-circleci-router.js";
import {maybeHandleModels} from "./model-router.js";
import {maybeHandleBenchmarks} from "./benchmark-router.js";
import {medicalImagingMeta} from "./medical-imaging-toolkit.js";
import {chooseModalAccelerator,modalCpuSelftest,modalGpuSelftest,modalHealth,modalMeta} from "./modal.js";
import {modalBoundedCompute} from "./modal-generic-compute.js";
export {CenterGate};

async function normalizeMedicalImagingRequest(req){
  const u=new URL(req.url);
  if(req.method!=="POST"||u.pathname!=="/v1/run")return req;
  let body;try{body=await req.clone().json()}catch{return req}
  if(String(body?.profile||"")!=="medical-imaging")return req;
  const gpu=Boolean(body?.gpu);
  body={...body,profile:gpu?"gpu":"core",input:{...(body?.input&&typeof body.input==="object"&&!Array.isArray(body.input)?body.input:{}),medical_imaging_toolkit:true,requested_profile:"medical-imaging"}};
  const headers=new Headers(req.headers);headers.set("content-type","application/json");headers.delete("content-length");
  return new Request(req.url,{method:"POST",headers,body:JSON.stringify(body)});
}

function googleCredentialState(env){const eeSecret=Boolean(env.GOOGLE_EE_SERVICE_ACCOUNT_JSON),cloudSecret=Boolean(env.GOOGLE_CLOUD_CREDENTIALS),eeProject=Boolean(String(env.GOOGLE_EE_PROJECT_ID||"").trim()),cloudProject=Boolean(String(env.GOOGLE_CLOUD_PROJECT||"").trim());return{service_account_configured:eeSecret||cloudSecret,credential_source:eeSecret?"google-ee-specific":cloudSecret?"google-cloud-standard":null,project_override_configured:eeProject||cloudProject,project_override_source:eeProject?"google-ee-env":cloudProject?"google-cloud-env":null,accepted_credential_vars:["GOOGLE_CLOUD_CREDENTIALS","GOOGLE_EE_SERVICE_ACCOUNT_JSON"],accepted_project_vars:["GOOGLE_CLOUD_PROJECT","GOOGLE_EE_PROJECT_ID"]}}
async function patchGoogleReadiness(req,response,env){const u=new URL(req.url);if(req.method!=="GET"||!["/health","/v1/capabilities","/capabilities","/v1/providers/google-ee/health","/v1/providers/google-ee/meta"].includes(u.pathname))return response;const body=await response.clone().json().catch(()=>null);if(!body||typeof body!=="object")return response;const state=googleCredentialState(env);if(body.compute_backends?.google_earth_engine)Object.assign(body.compute_backends.google_earth_engine,state);if(u.pathname==="/v1/providers/google-ee/health")Object.assign(body,{configured:state.service_account_configured,credential_source:body.credential_source||state.credential_source});if(u.pathname==="/v1/providers/google-ee/meta")Object.assign(body,state);return Response.json(body,{status:response.status,headers:{"cache-control":"no-store"}})}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==="GET"&&u.pathname==="/v1/toolkits/medical-imaging/meta")return Response.json({ok:true,...medicalImagingMeta(),request_profile:"medical-imaging",gpu_optional:true},{headers:{"cache-control":"no-store"}});
    if(req.method==="GET"&&u.pathname==="/v1/providers/modal/meta")return Response.json({ok:true,...modalMeta(),secret_echo:false},{headers:{"cache-control":"no-store"}});
    if(req.method==="GET"&&u.pathname==="/v1/providers/modal/health"){const p=await modalHealth(env);return Response.json(p,{status:p.ok?200:503,headers:{"cache-control":"no-store"}})}
    if(req.method==="POST"&&u.pathname==="/v1/providers/modal/route/plan"){
      let body={};try{body=await req.json()}catch{}
      return Response.json({ok:true,...chooseModalAccelerator(body),secret_echo:false},{headers:{"cache-control":"no-store"}});
    }
    if(req.method==="POST"&&u.pathname==="/v1/providers/modal/compute"){
      let body={};try{body=await req.json()}catch{}
      const p=await modalBoundedCompute(env,{op:body?.op,values:body?.values});
      return Response.json(p,{status:p.http_status|| (p.ok?200:503),headers:{"cache-control":"no-store"}});
    }
    if(req.method==="POST"&&u.pathname==="/v1/providers/modal/selftest/cpu"){
      let body={};try{body=await req.json()}catch{}
      const n=body?.n===undefined?10000:Number(body.n);
      const p=await modalCpuSelftest(env,n);
      return Response.json(p,{status:p.ok?200:503,headers:{"cache-control":"no-store"}});
    }
    if(req.method==="POST"&&u.pathname==="/v1/providers/modal/selftest/gpu"){
      let body={};try{body=await req.json()}catch{}
      const n=body?.n===undefined?10000:Number(body.n);
      const p=await modalGpuSelftest(env,n);
      return Response.json(p,{status:p.ok?200:503,headers:{"cache-control":"no-store"}});
    }
    req=await normalizeMedicalImagingRequest(req);
    const benchmarkHandled=await maybeHandleBenchmarks(req);
    if(benchmarkHandled)return benchmarkHandled;
    const modelHandled=await maybeHandleModels(req,env);
    if(modelHandled)return modelHandled;
    const handled=await maybeHandleBaiduCircleCI(req,env);
    if(handled)return handled;
    const response=await production.fetch(req,env,ctx);
    return patchGoogleReadiness(req,response,env);
  }
};
