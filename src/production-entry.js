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
    return production.fetch(req,env,ctx);
  }
};
