import guard,{CenterGate} from "./guard.js";
import {probeOpenEO,openEOMeta} from "./openeo.js";
import {probeBaiduAIStudio,baiduAIStudioMeta} from "./baidu-aistudio.js";
import {probeEarthEngine,stressEarthEngine} from "./google-ee.js";
export {CenterGate};

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
let openEOHealth={at:0,value:null};
let baiduHealth={at:0,value:null};
let googleEEHealth={at:0,value:null};

async function openEOProbe(env){
  const now=Date.now();
  if(openEOHealth.value&&now-openEOHealth.at<300000)return {...openEOHealth.value,cached_health:true};
  try{
    const p=await probeOpenEO(env,{federated:false});
    const value={ok:p.ok===true,provider:"copernicus-openeo",configured:p.configured===true,authenticated:p.authenticated===true,endpoint:p.endpoint||"core-cdse",account_visible:p.account_visible===true,budget_reported:p.budget_reported===true,api_version:p.api_version||"unknown",backend_id:p.backend_id||"",secret_echo:false};
    openEOHealth={at:now,value};return value;
  }catch(e){const value={ok:false,provider:"copernicus-openeo",configured:Boolean(env.CDSE_CLIENT_ID&&env.CDSE_CLIENT_SECRET),authenticated:false,error_class:String(e?.message||"OPENEO_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};openEOHealth={at:now,value};return value}
}

async function baiduProbe(env){const now=Date.now();if(baiduHealth.value&&now-baiduHealth.at<300000)return {...baiduHealth.value,cached_health:true};const value=await probeBaiduAIStudio(env);baiduHealth={at:now,value};return value}

async function googleEEProbe(env){
  const now=Date.now();
  if(googleEEHealth.value&&now-googleEEHealth.at<300000)return {...googleEEHealth.value,cached_health:true};
  try{
    const p=await probeEarthEngine(env,{compute:false});
    const value={ok:p.ok===true,provider:"google-earth-engine",configured:p.configured===true,oauth:p.oauth===true,registration_state:p.registration_state||"UNKNOWN",project_source:p.project_source||null,secret_echo:false};
    googleEEHealth={at:now,value};return value;
  }catch(e){const value={ok:false,provider:"google-earth-engine",configured:Boolean(env.GOOGLE_EE_SERVICE_ACCOUNT_JSON),oauth:false,error_class:String(e?.message||"GOOGLE_EE_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};googleEEHealth={at:now,value};return value}
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/meta")return json({ok:true,provider:"copernicus-openeo",...openEOMeta(),secret_echo:false});
    if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/health"){const p=await openEOProbe(env);return json(p,p.ok?200:503)}
    if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/meta")return json({ok:true,...baiduAIStudioMeta(),secret_echo:false});
    if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/health"){const p=await baiduProbe(env);return json(p,p.manual_ready?200:503)}
    if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/meta")return json({ok:true,provider:"google-earth-engine",automation_mode:"service-account-rest",arbitrary_code:false,service_binding_selftest:true,secret_echo:false});
    if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/health"){const p=await googleEEProbe(env);return json(p,p.ok?200:503)}
    if(req.method==="POST"&&u.pathname==="/v1/providers/google-ee/selftest"){
      if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"Google Earth Engine selftest is service-binding internal only"},403);
      try{
        const tiny=await probeEarthEngine(env,{compute:true}),stress=await stressEarthEngine(env),ok=tiny.ok===true&&tiny.compute_ok===true&&stress.ok===true;
        return json({ok,provider:"google-earth-engine",business_e2e:true,tiny_compute_ok:tiny.compute_ok===true,parallel_requests:stress.parallel_requests,parallel_all_correct:stress.parallel_all_correct===true,parallel_http_statuses:stress.parallel_http_statuses,geospatial_graph_ok:stress.geospatial_graph_ok===true,negative_request_rejected:stress.negative_request_rejected===true,negative_http_status:stress.negative_http_status,elapsed_ms:stress.elapsed_ms,secret_echo:false},ok?200:503);
      }catch(e){return json({ok:false,provider:"google-earth-engine",business_e2e:true,error_class:String(e?.message||"GOOGLE_EE_SELFTEST_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false},503)}
    }
    return guard.fetch(req,env,ctx);
  }
};