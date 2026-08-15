import guard,{CenterGate} from "./guard.js";
import {probeOpenEO,openEOMeta} from "./openeo.js";
export {CenterGate};

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
let openEOHealth={at:0,value:null};

async function openEOProbe(env){
  const now=Date.now();
  if(openEOHealth.value&&now-openEOHealth.at<300000)return {...openEOHealth.value,cached_health:true};
  try{
    const p=await probeOpenEO(env,{federated:false});
    const value={
      ok:p.ok===true,
      provider:"copernicus-openeo",
      configured:p.configured===true,
      authenticated:p.authenticated===true,
      endpoint:p.endpoint||"core-cdse",
      account_visible:p.account_visible===true,
      budget_reported:p.budget_reported===true,
      api_version:p.api_version||"unknown",
      backend_id:p.backend_id||"",
      secret_echo:false
    };
    openEOHealth={at:now,value};
    return value;
  }catch(e){
    const value={ok:false,provider:"copernicus-openeo",configured:Boolean(env.CDSE_CLIENT_ID&&env.CDSE_CLIENT_SECRET),authenticated:false,error_class:String(e?.message||"OPENEO_PROBE_FAILED"),http_status:Number(e?.status||0)||null,secret_echo:false};
    openEOHealth={at:now,value};
    return value;
  }
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/meta")return json({ok:true,provider:"copernicus-openeo",...openEOMeta(),secret_echo:false});
    if(req.method==="GET"&&u.pathname==="/v1/providers/openeo/health"){
      const p=await openEOProbe(env);
      return json(p,p.ok?200:503);
    }
    return guard.fetch(req,env,ctx);
  }
};
