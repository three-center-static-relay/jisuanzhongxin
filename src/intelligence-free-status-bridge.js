const MODEL_ID="zai-org/GLM-4.7-Flash";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

const bool=v=>v===true;
const hex64=v=>/^[a-f0-9]{64}$/i.test(String(v||""));

export async function intelligenceFreeStatusBridge(env){
  if(!env.INTELLIGENCE_CENTER?.fetch)return json({ok:false,selftest:"intelligence-free-model-status",error:"INTELLIGENCE_CENTER_UNAVAILABLE",inference_called:false,model_tokens_used:0,cost_incurred:false,paid_fallback_allowed:false,secrets_redacted:true},503);

  const taskId=`compute-bridge-hf-free-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  let response;
  try{
    response=await env.INTELLIGENCE_CENTER.fetch(new Request("https://intelligence.internal/v1/run",{
      method:"POST",
      headers:{"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({task_id:taskId,provider:"huggingface",operation:"free_model_status",timeout_seconds:50,args:{model_id:MODEL_ID}})
    }));
  }catch(error){
    return json({ok:false,selftest:"intelligence-free-model-status",model_id:MODEL_ID,error:"SERVICE_BINDING_CALL_FAILED",message:String(error?.message||error),inference_called:false,model_tokens_used:0,cost_incurred:false,paid_fallback_allowed:false,secrets_redacted:true},503);
  }

  const raw=await response.text();
  let body=null;
  try{body=raw?JSON.parse(raw):null}catch{}
  const result=body?.result||null;
  const vendor=result?.vendor||null;
  const access=vendor?.access||null;
  const keyPresent=access?.key_present===true;
  const registrationRequired=access?.registration_required===true;
  const registrationLogicOk=vendor?.vendor_free_verified===true&&registrationRequired===!keyPresent;

  const checks={
    http_200:response.status===200,
    body_ok:body?.ok===true,
    provider:body?.provider==="huggingface",
    operation:body?.operation==="free_model_status",
    result_object:!!result&&typeof result==="object",
    digest:hex64(body?.result_digest),
    model_id:result?.model_id===MODEL_ID,
    final_free_status:result?.final_free_status==="vendor_confirmed_free",
    recommended_access:result?.recommended_access==="vendor_direct_api",
    vendor_verified:vendor?.vendor_free_verified===true,
    vendor_status:vendor?.vendor_free_status==="vendor_confirmed_free",
    required_secret:access?.required_secret==="ZAI_API_KEY",
    registration_logic:registrationLogicOk,
    paid_fallback_disabled:result?.paid_fallback_allowed===false
  };
  const strictPass=Object.values(checks).every(bool);

  return json({
    ok:strictPass,
    selftest:"intelligence-free-model-status",
    model_id:MODEL_ID,
    upstream_http_status:response.status,
    upstream_ok:body?.ok===true,
    provider:body?.provider||null,
    operation:body?.operation||null,
    result_digest:body?.result_digest||null,
    final_free_status:result?.final_free_status||null,
    recommended_access:result?.recommended_access||null,
    vendor_free_verified:vendor?.vendor_free_verified===true,
    vendor_free_status:vendor?.vendor_free_status||null,
    vendor_source_type:vendor?.evidence?.source_type||null,
    required_secret:access?.required_secret||null,
    key_present:keyPresent,
    registration_required:registrationRequired,
    paid_fallback_allowed:result?.paid_fallback_allowed??null,
    checks,
    upstream_error:body?.error||null,
    upstream_message:body?.message||null,
    upstream_body_prefix:body?null:raw.slice(0,240),
    inference_called:false,
    model_tokens_used:0,
    cost_incurred:false,
    secrets_redacted:true
  },strictPass?200:503);
}
