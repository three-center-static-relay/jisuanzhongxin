import k,{CenterGate} from "./production-entry-baidu-k-e2e.js";
export {CenterGate};

const TASK_ID="baidu-circleci-live-20260816k";
const PATH="/__acceptance/baidu-v100-shell-k-20260816k-83f1c4/circleci";
const EXPIRES_AT=Date.parse("2026-08-16T16:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function load(env){const r=await gate(env).fetch(new Request(`https://gate.internal/task/${encodeURIComponent(TASK_ID)}`));return r.json().catch(()=>({}))}
async function cf(env,path){const token=String(env.CIRCLECI_API_TOKEN||"").trim();if(!token)return{ok:false,http:0,error:"CIRCLECI_TOKEN_MISSING"};const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await fetch(`https://circleci.com/api/v2${path}`,{headers:{"Circle-Token":token,accept:"application/json"},signal:c.signal});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{}return{ok:r.ok,http:r.status,data}}catch(e){return{ok:false,http:0,error:e?.name==="AbortError"?"CIRCLECI_API_TIMEOUT":"CIRCLECI_API_NETWORK_ERROR"}}finally{clearTimeout(timer)}}
function clean(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9_.:-]/g,"").slice(0,80)||"unknown"}
async function state(env){
  const t=(await load(env)).task;if(!t)return json({ok:false,error:"TASK_NOT_FOUND"},404);
  const pid=String(t.circleci_pipeline_id||"").trim();if(!pid)return json({ok:false,error:"CIRCLECI_PIPELINE_ID_MISSING"},409);
  const wf=await cf(env,`/pipeline/${encodeURIComponent(pid)}/workflow`);if(!wf.ok)return json({ok:false,error:wf.error||"CIRCLECI_WORKFLOW_LOOKUP_FAILED",circle_http:wf.http},502);
  const workflows=Array.isArray(wf.data?.items)?wf.data.items:[];if(!workflows.length)return json({ok:true,classification:"NO_WORKFLOW",task_status:t.status||null});
  const w=workflows[0],wid=String(w.id||"").trim();if(!wid)return json({ok:true,classification:"WORKFLOW_WITHOUT_ID",workflow_status:clean(w.status)});
  const jr=await cf(env,`/workflow/${encodeURIComponent(wid)}/job`);if(!jr.ok)return json({ok:false,error:jr.error||"CIRCLECI_JOB_LOOKUP_FAILED",circle_http:jr.http},502);
  const jobs=Array.isArray(jr.data?.items)?jr.data.items:[];
  const failed=jobs.find(x=>["failed","failing"].includes(clean(x.status)))||jobs[0]||null;
  const safeJobs=jobs.slice(0,5).map(x=>({name:clean(x.name),status:clean(x.status),job_number:Number(x.job_number||0)||null,project_slug:clean(x.project_slug)}));
  let detail=null;
  if(failed&&Number(failed.job_number||0)>0&&String(failed.project_slug||"").trim()){
    const slug=String(failed.project_slug).trim(),n=Number(failed.job_number);
    const d=await cf(env,`/project/${encodeURIComponent(slug)}/job/${n}`);
    if(d.ok){const msgs=Array.isArray(d.data?.messages)?d.data.messages:[];detail={http:200,executor_type:clean(d.data?.executor?.type),resource_class:clean(d.data?.resource_class),duration:Number(d.data?.duration||0)||null,messages:msgs.slice(0,8).map(m=>({type:clean(m?.type),reason:clean(m?.reason)})),message_count:msgs.length};}
    else detail={http:d.http,error:d.error||"CIRCLECI_JOB_DETAIL_FAILED"};
  }
  let classification="JOBS_OTHER";const statuses=safeJobs.map(x=>x.status);
  if(statuses.some(x=>["failed","failing"].includes(x)))classification=detail?.message_count>0?"JOB_NOT_RUN_WITH_REASON":"JOB_FAILED_AFTER_START_OR_NO_REASON";else if(statuses.some(x=>["canceled","cancelled"].includes(x)))classification="JOB_CANCELED";else if(statuses.some(x=>["running","queued","on_hold","blocked","not_run"].includes(x)))classification="JOB_ACTIVE";else if(statuses.length&&statuses.every(x=>x==="success"))classification="JOBS_SUCCESS";
  return json({ok:true,classification,workflow_status:clean(w.status),jobs:safeJobs,job_detail:detail,task_status:t.status||null});
}
export default {async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname===PATH){if(req.method!=="GET")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);if(Date.now()>EXPIRES_AT)return json({ok:false,error:"DIAG_ROUTE_EXPIRED"},410);return state(env)}return k.fetch(req,env,ctx)}};
