import production,{CenterGate} from "./production.js";
import {maybeHandleBaiduCircleCI} from "./baidu-circleci-router.js";
import {maybeHandleModels} from "./model-router.js";
import {maybeHandleBenchmarks} from "./benchmark-router.js";
import {medicalImagingMeta} from "./medical-imaging-toolkit.js";
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
