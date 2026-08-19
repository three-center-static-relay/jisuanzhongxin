const ID="ms-lite-v4-acceptance-20260820";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
function safeStatus(status={}){
  const out=status?.output&&typeof status.output==="object"?status.output:null;
  const receipt=out?.runtime_receipt&&typeof out.runtime_receipt==="object"?out.runtime_receipt:null;
  const error=String(status?.error?.message||status?.error||"")
    .replace(/https?:\/\/\S+/gi,"[URL]")
    .replace(/[A-Za-z0-9._~-]{24,}/g,"[REDACTED]")
    .replace(/\s+/g," ").trim().slice(0,180)||null;
  return{
    status:String(status?.status||status?.state||"")||null,
    error,
    output:out?{
      ok:out.ok===true,
      stage:out.stage||null,
      target_hardware:out.target_hardware||null,
      resource_type:out.resource_type||null,
      runtime_receipt:receipt?{
        ok:receipt.ok===true,
        revision:receipt.revision||null,
        cpu_effective:Number(receipt.cpu_effective||0),
        memory_gib_effective:Number(receipt.memory_gib_effective||0),
        square_sum_correct:receipt.square_sum_correct===true,
        result_digest_present:/^[a-f0-9]{64}$/i.test(String(receipt.result_digest||"")),
        python:receipt.python||null
      }:null,
      stopped:out.stopped?{http_status:Number(out.stopped.http_status||0)||null}:null,
      polling_rounds_max:Number(out.polling_rounds_max||0)||null,
      polling_sleep_seconds:Number(out.polling_sleep_seconds||0)||null,
      free_only:out.free_only===true,
      paid_fallback:out.paid_fallback===true
    }:null
  };
}
async function start(env){
  if(!env.MODELSCOPE_STUDIO_WORKFLOW?.create||!env.MODELSCOPE_STUDIO_WORKFLOW?.get)return json({ok:false,error:"MODELSCOPE_STUDIO_WORKFLOW_UNAVAILABLE"},503);
  let instance;
  try{
    instance=await env.MODELSCOPE_STUDIO_WORKFLOW.create({id:ID,params:{requested_at:new Date().toISOString(),free_only:true,acceptance_revision:"studio-lite-runtime-v3-20260820",observation_window_seconds:240},retention:{successRetention:"1 day",errorRetention:"1 day"}});
  }catch{
    try{instance=await env.MODELSCOPE_STUDIO_WORKFLOW.get(ID)}catch{return json({ok:false,error:"MODELSCOPE_V4_WORKFLOW_CREATE_FAILED",free_only:true,paid_fallback:false,secrets_redacted:true},503)}
  }
  return json({ok:true,provider:"modelscope-studio-lite",workflow_id:ID,workflow:safeStatus(await instance.status()),free_only:true,paid_fallback:false,secrets_redacted:true,one_shot:true});
}
async function status(env){
  if(!env.MODELSCOPE_STUDIO_WORKFLOW?.get)return json({ok:false,error:"MODELSCOPE_STUDIO_WORKFLOW_UNAVAILABLE"},503);
  try{
    const instance=await env.MODELSCOPE_STUDIO_WORKFLOW.get(ID);
    return json({ok:true,provider:"modelscope-studio-lite",workflow_id:ID,workflow:safeStatus(await instance.status()),free_only:true,paid_fallback:false,secrets_redacted:true,one_shot:true});
  }catch{return json({ok:false,error:"MODELSCOPE_V4_WORKFLOW_NOT_FOUND",free_only:true,paid_fallback:false,secrets_redacted:true},404)}
}
export async function maybeHandleModelScopeStudioLiteV4Control(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/_diag/mslite-v4-start-T8p2")return start(env);
  if(req.method==="GET"&&u.pathname==="/_diag/mslite-v4-status-T8p2")return status(env);
  return null;
}
