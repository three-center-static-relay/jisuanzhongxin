import app,{CenterGate} from "./production-entry.js";
import {getAutonomySnapshot,runAutonomySweep} from "./provider-autonomy.js";
export {CenterGate};

const ORIGIN="https://compute.internal";
const SERVICE="compute-worker";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function readGate(env){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE",active:null};
  const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));
  const response=await gate.fetch(new Request("https://gate.internal/state",{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gate=await readGate(env);
  const autonomy=await getAutonomySnapshot(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true&&autonomy.ok===true;
  return json({ok,service:SERVICE,admin_read_only:true,observed_at:new Date().toISOString(),runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},health:health.body,source:source.body,acceptance:acceptance.body,autonomy,active_task:gate.active||null,active_state_verified:gate.ok===true,secrets_redacted:true},ok?200:503);
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"admin context is service-binding internal only"},403);
      return adminContext(env,ctx);
    }
    if(req.method==="GET"&&url.pathname==="/v1/admin/autonomy"){
      if(url.hostname!=="compute.internal")return json({ok:false,error:"POLICY_DENIED",message:"autonomy status is service-binding internal only"},403);
      return json(await getAutonomySnapshot(env));
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(_controller,env,ctx){
    ctx.waitUntil(runAutonomySweep(app,env,ctx));
  }
};
