import h,{CenterGate} from "./production-entry-baidu-h-e2e.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260815h";
const PID_PATH="/__acceptance/baidu-v100-e2e-20260815h-7d3a41/pid-2f0b77";
const EXPIRES_AT=Date.parse("2026-08-16T00:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function load(env){const r=await gate(env).fetch(new Request(`https://gate.internal/task/${encodeURIComponent(TASK_ID)}`));return r.json().catch(()=>({}))}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname===PID_PATH){
      if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
      if(Date.now()>EXPIRES_AT)return json({ok:false,error:"DIAG_ROUTE_EXPIRED"},410);
      const t=(await load(env)).task||null;
      const pid=String(t?.baidu_job_id||"").trim();
      if(!/^[A-Za-z0-9._:-]{3,128}$/.test(pid))return json({ok:false,error:"PID_NOT_AVAILABLE"},404);
      return json({ok:true,task_id:TASK_ID,pipeline_id:pid});
    }
    return h.fetch(req,env,ctx);
  }
};
