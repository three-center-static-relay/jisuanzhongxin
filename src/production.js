import guard,{CenterGate} from "./guard.js";
import {probeOpenEO,openEOMeta,runOpenEOAcceptanceSelftest} from "./openeo.js";
import {probeBaiduAIStudio,baiduAIStudioMeta} from "./baidu-aistudio.js";
import {probeEarthEngine,stressEarthEngine} from "./google-ee.js";
import {introspect as kaggleIntrospect,officialMeta as kaggleOfficialMeta} from "./kaggle-official.js";
import {probeWolfram,wolframMeta} from "./wolfram.js";
import {modelscopeMeta,planModelScopeRoute,probeModelScope} from "./modelscope-compute.js";
export {CenterGate};

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const OPENEO_ACCEPTANCE_NONCE_SHA256="3fc8f6603f1c0e627b085a6ccfa7cf3883cb3e26c6bf9b09e889a8686ea91f0f";
let openEOHealth={at:0,value:null};
let baiduHealth={at:0,value:null};
let googleEEHealth={at:0,value:null};
let kaggleHealth={at:0,value:null};
let wolframHealth={at:0,value:null};
let modelscopeHealth={at:0,value:null};

async function sha256Text(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function openEOProbe(env){const now=Date.now();if(openEOHealth.value&&now-openEOHealth.at<300000)return {...openEOHealth.value,cached_health:true};try{const p=await probeOpenEO(env,{federated:false});const value={ok:p.ok===true,provider:"copernicus-openeo",configured:p.configured===true,authenticated:p.authenticated===true,endpoint:p.endpoint||"core-cdse",account_visible:p.account_visible===true,budget_reported:p.budget_reported===true,api_version:p.api_version||"unknown",backend_id:p.backend_id||"",secret_echo:false};openEOHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"copernicus-openeo",configured:Boolean(env.CDSE_CLIENT_ID&&env.CDSE_CLIENT_SECRET),authenticated:false,error_class:String(e?.message||"OPENEO_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};openEOHealth={at:now,value};return value}}
async function baiduProbe(env){const now=Date.now();if(baiduHealth.value&&now-baiduHealth.at<300000)return {...baiduHealth.value,cached_health:true};const value=await probeBaiduAIStudio(env);baiduHealth={at:now,value};return value}
async function googleEEProbe(env){const now=Date.now();if(googleEEHealth.value&&now-googleEEHealth.at<300000)return {...googleEEHealth.value,cached_health:true};try{const p=await probeEarthEngine(env,{compute:false});const value={ok:p.ok===true,provider:"google-earth-engine",configured:p.configured===true,oauth:p.oauth===true,registration_state:p.registration_state||"UNKNOWN",project_source:p.project_source||null,secret_echo:false};googleEEHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"google-earth-engine",configured:Boolean(env.GOOGLE_EE_SERVICE_ACCOUNT_JSON),oauth:false,error_class:String(e?.message||"GOOGLE_EE_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};googleEEHealth={at:now,value};return value}}
async function kaggleProbe(env){const now=Date.now();if(kaggleHealth.value&&now-kaggleHealth.at<300000)return {...kaggleHealth.value,cached_health:true};try{const who=await kaggleIntrospect(env),value={ok:who.active===true,provider:"kaggle",configured:Boolean(env.KAGGLE_API_TOKEN),authenticated:who.active===true,username_resolved:Boolean(who.username),business_e2e:true,historically_verified:true,live_health_required:true,route_eligible:who.active===true,acceptance_state:"verified-current-cpu-t4-e2e",secret_echo:false};kaggleHealth={at:now,value};return value}catch(e){const value={ok:false,provider:"kaggle",configured:Boolean(env.KAGGLE_API_TOKEN),authenticated:false,business_e2e:false,historically_verified:true,live_health_required:true,route_eligible:false,error_class:String(e?.message||"KAGGLE_PROBE_FAILED"),http_status:Number(e?.status||0)||null,acceptance_state:"live-health-failed",secret_echo:false};kaggleHealth={at:now,value};return value}}
async function wolframProbe(env){const now=Date.now();if(wolframHealth.value&&now-wolframHealth.at<300000)return {...wolframHealth.value,cached_health:true};const value=await probeWolfram(env);wolframHealth={at:now,value};return value}
async function modelscopeProbe(env){const now=Date.now();if(modelscopeHealth.value&&now-modelscopeHealth.at<300000)return {...modelscopeHealth.value,cached_health:true};const value=await probeModelScope(env);modelscopeHealth={at:now,value};return value}
async function googleEESelftest(env){try{const tiny=await probeEarthEngine(env,{compute:true}),stress=await stressEarthEngine(env),ok=tiny.ok===true&&tiny.compute_ok===true&&stress.ok===true;return{status:ok?200:503,body:{ok,provider:"google-earth-engine",business_e2e:true,tiny_compute_ok:tiny.compute_ok===true,parallel_requests:stress.parallel_requests,parallel_all_correct:stress.parallel_all_correct===true,parallel_http_statuses:stress.parallel_http_statuses,geospatial_graph_ok:stress.geospatial_graph_ok===true,negative_request_rejected:stress.negative_request_rejected===true,negative_http_status:stress.negative_http_status,elapsed_ms:stress.elapsed_ms,secret_echo:false}}}catch(e){return{status:503,body:{ok:false,provider:"google-earth-engine",business_e2e:true,error_class:String(e?.message||"GOOGLE_EE_SELFTEST_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false}}}}

export default {async fetch(req,env,ctx){const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/meta")return json({ok:true,provider:"copernicus-openeo",...openEOMeta(),secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/health"){const p=await openEOProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="POST"&&u.pathname==="/v1/providers/openeo/selftest/acceptance"){
    const nonce=String(req.headers.get("x-openeo-acceptance-nonce")||"");
    if(await sha256Text(nonce)!==OPENEO_ACCEPTANCE_NONCE_SHA256)return json({ok:false,error:"POLICY_DENIED",secret_echo:false},403);
    try{const p=await runOpenEOAcceptanceSelftest(env);return json({selftest:"openeo-service-account-linkage",...p},p.ok?200:503)}catch(e){return json({ok:false,selftest:"openeo-service-account-linkage",error_class:String(e?.message||"OPENEO_SELFTEST_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false},503)}
  }
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/meta")return json({ok:true,...baiduAIStudioMeta(),acceptance_state:"manual-auth-only-not-production",native_http_candidate:false,unattended_e2e_verified:false,route_eligible:false,secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/baidu/health"){const p=await baiduProbe(env);return json({...p,acceptance_state:p.manual_ready?"manual-auth-only-not-production":"not-ready",native_http_candidate:false,unattended_e2e_verified:false,route_eligible:false},p.manual_ready?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/kaggle/meta")return json({ok:true,provider:"kaggle",...kaggleOfficialMeta(),business_e2e:true,historically_verified:true,live_health_required:true,route_eligible:Boolean(env.KAGGLE_API_TOKEN),route_eligibility:"token-and-live-health-required",acceptance_state:"verified-current-cpu-t4-e2e",secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/kaggle/health"){const p=await kaggleProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/modelscope/meta")return json({ok:true,...modelscopeMeta(),secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/modelscope/health"){const p=await modelscopeProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="POST"&&u.pathname==="/v1/providers/modelscope/route/plan"){let body={};try{body=await req.json()}catch{}return json({ok:true,...planModelScopeRoute(body),secret_echo:false});}
  if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/meta")return json({ok:true,provider:"google-earth-engine",automation_mode:"service-account-rest",arbitrary_code:false,service_binding_selftest:true,secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/google-ee/health"){const p=await googleEEProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="GET"&&u.pathname==="/v1/providers/wolfram/meta")return json({ok:true,...wolframMeta(),secret_echo:false});
  if(req.method==="GET"&&u.pathname==="/v1/providers/wolfram/health"){const p=await wolframProbe(env);return json(p,p.ok?200:503)}
  if(req.method==="POST"&&u.pathname==="/v1/providers/google-ee/selftest"){if(u.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"Google Earth Engine selftest is service-binding internal only"},403);const r=await googleEESelftest(env);return json(r.body,r.status)}
  return guard.fetch(req,env,ctx);
}};