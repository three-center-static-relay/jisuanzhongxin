const CIRCLE_API="https://circleci.com/api/v2";
const ALLOWED_OPS=new Set(["SUBMIT","CHECK","FETCH","CANCEL"]);
const encSlug=s=>String(s||"").split("/").map(encodeURIComponent).join("/");
const str=(v)=>String(v||"").trim();
const bool=(v)=>String(v||"").toLowerCase()==="true";

export function baiduCircleCIMeta(env={}){
  const configured=Boolean(str(env.CIRCLECI_API_TOKEN)&&str(env.CIRCLECI_PROJECT_SLUG)&&str(env.CIRCLECI_PIPELINE_DEFINITION_ID)&&str(env.BAIDU_BRIDGE_SHARED_SECRET));
  const e2eVerified=bool(env.BAIDU_CIRCLECI_E2E_VERIFIED);
  return {
    provider:"circleci",
    role:"baidu-aistudio-official-cli-bridge",
    configured,
    e2e_verified:e2eVerified,
    automation_ready:configured&&e2eVerified,
    route_eligible:configured&&e2eVerified,
    trigger:"circleci-api-v2",
    executor:"docker-python",
    allowed_operations:["SUBMIT","CHECK","FETCH","CANCEL"],
    baidu_payment:"coupon",
    baidu_device:"v100",
    baidu_gpus:1,
    arbitrary_code:false,
    arbitrary_shell:false,
    input_transport:"authenticated-task-manifest-pull",
    max_task_seconds:900,
    secret_echo:false
  };
}

function requireConfig(env){
  const token=str(env.CIRCLECI_API_TOKEN),project=str(env.CIRCLECI_PROJECT_SLUG),definition=str(env.CIRCLECI_PIPELINE_DEFINITION_ID),secret=str(env.BAIDU_BRIDGE_SHARED_SECRET);
  if(!token||!project||!definition||!secret)throw Object.assign(new Error("BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"),{status:503});
  return {token,project,definition,branch:str(env.CIRCLECI_CONFIG_BRANCH)||"main"};
}

export async function triggerBaiduBridge(env,{op,task_id,baidu_job_id=""}){
  const cfg=requireConfig(env),operation=str(op).toUpperCase();
  if(!ALLOWED_OPS.has(operation))throw Object.assign(new Error("BAIDU_BRIDGE_OPERATION_DENIED"),{status:400});
  const id=str(task_id);
  if(!/^[A-Za-z0-9._:-]{1,96}$/.test(id))throw Object.assign(new Error("BAIDU_BRIDGE_TASK_ID_INVALID"),{status:400});
  const job=str(baidu_job_id);
  if(job&&!/^[A-Za-z0-9._:-]{1,128}$/.test(job))throw Object.assign(new Error("BAIDU_BRIDGE_JOB_ID_INVALID"),{status:400});
  const body={
    definition_id:cfg.definition,
    config:{branch:cfg.branch},
    checkout:{branch:cfg.branch},
    parameters:{bridge_dispatch:true,bridge_op:operation,task_id:id,baidu_job_id:job}
  };
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
  try{
    const r=await fetch(`${CIRCLE_API}/project/${encSlug(cfg.project)}/pipeline/run`,{method:"POST",headers:{"Circle-Token":cfg.token,"content-type":"application/json",accept:"application/json"},body:JSON.stringify(body),signal:c.signal});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{}
    if(!r.ok)throw Object.assign(new Error(`CIRCLECI_HTTP_${r.status}`),{status:r.status>=500?502:r.status,details:{circle_status:r.status}});
    return {ok:true,pipeline_id:str(data.id)||null,pipeline_number:Number(data.number||0)||null,state:str(data.state)||"created"};
  }catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("CIRCLECI_TRIGGER_TIMEOUT"),{status:504});throw e}
  finally{clearTimeout(timer)}
}

export function bridgeAuthorized(req,env){
  const expected=str(env.BAIDU_BRIDGE_SHARED_SECRET),actual=str(req.headers.get("x-three-center-bridge-secret"));
  if(!expected||!actual||expected.length!==actual.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
  return diff===0;
}

export function normalizeBaiduInput(input={}){
  const clamp=(v,a,b,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,Math.trunc(n))):d};
  return {matrix_size:clamp(input.matrix_size,256,2048,1024),rounds:clamp(input.rounds,1,5,2),seed:clamp(input.seed,1,2147483647,20260815)};
}
