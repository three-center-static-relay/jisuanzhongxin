const CIRCLE_API="https://circleci.com/api/v2";
const ALLOWED_OPS=new Set(["SUBMIT","CHECK","FETCH","CANCEL","SDK_SELFTEST"]);
const PRODUCTION_RUNTIME=null;
const encSlug=s=>String(s||"").split("/").map(encodeURIComponent).join("/");
const str=v=>String(v||"").trim();
const bool=v=>String(v||"").toLowerCase()==="true";

export function baiduCircleCIMeta(env={}){
  const configured=Boolean(str(env.CIRCLECI_API_TOKEN)&&str(env.CIRCLECI_PROJECT_SLUG)&&str(env.CIRCLECI_PIPELINE_DEFINITION_ID));
  const acceptanceFlag=bool(env.BAIDU_CIRCLECI_E2E_VERIFIED);
  const productionRuntime=PRODUCTION_RUNTIME;
  const e2eVerified=acceptanceFlag&&Boolean(productionRuntime);
  return {
    provider:"circleci",
    role:"baidu-aistudio-official-cli-bridge",
    configured,
    acceptance_flag_present:acceptanceFlag,
    e2e_verified:e2eVerified,
    automation_ready:configured&&e2eVerified,
    route_eligible:configured&&e2eVerified,
    trigger:"circleci-api-v2",
    executor:"docker-python",
    allowed_operations:["SUBMIT","CHECK","FETCH","CANCEL","SDK_SELFTEST"],
    baidu_payment:"coupon",
    free_only:true,
    paid_fallback:false,
    acoin_allowed:false,
    baidu_device:"v100",
    baidu_gpus:1,
    sdk_pinned:"aistudio-sdk==0.3.8",
    sdk_upgrade_candidate:"aistudio-sdk==0.3.9",
    sdk_candidate_probe:"circleci-control-plane-live-verified",
    sdk_candidate_control_plane_verified:true,
    sdk_candidate_control_plane_evidence:{
      task_id:"baidu-sdk039-control-plane-20260816c",
      state:"completed",
      sdk_selftest_passed:true,
      terminal_callback_received:true,
      gpu_submitted:false,
      compute_credit_used:false,
      production_promoted:false,
      verified_at:"2026-08-16T23:53:42Z",
      verification_transport:"cloudflare-build-live-status-probe"
    },
    sdk_candidate_gpu_submission:false,
    sdk_candidate_gpu_verified:false,
    sdk_candidate_gpu_attempt_evidence:{
      task_id:"baidu-circleci-live-20260817p24c-sdk039",
      sdk_version:"0.3.9",
      runtime:"paddle2.4_py3.7",
      intended_device:"v100",
      intended_gpus:1,
      payment:"coupon",
      state:"failed",
      failure_class:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT",
      bridge_stage:"aistudio_submit_returned",
      circleci_pipeline_created:true,
      aistudio_auth_verified:true,
      aistudio_submit_returned:true,
      baidu_job_id_confirmed:false,
      gpu_job_confirmed:false,
      result_digest_present:false,
      bridge_result_retrieved:false,
      v100_cuda_verified:false,
      production_promoted:false,
      classified_at:"2026-08-17T00:21:43Z"
    },
    sdk_upgrade_for_diagnostics:false,
    diagnostic_surface:"pipeline-query-stage-plus-bootstrap-sentinel",
    public_callable_log_detail_info:{"0.3.8":false,"0.3.9":false},
    runtime_production:productionRuntime,
    runtime_candidate:"paddle2.4_py3.7",
    runtime_candidate_state:"QUARANTINED",
    runtime_candidate_evidence:{
      live_e2e_failures:3,
      latest_task_id:"baidu-circleci-live-20260817p24c-sdk039",
      latest_sdk_version:"0.3.9",
      latest_state:"failed",
      latest_failure_class:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT",
      latest_bridge_stage:"aistudio_submit_returned",
      circleci_pipeline_created:true,
      aistudio_auth_verified:true,
      aistudio_submit_returned:true,
      baidu_job_id_confirmed:false,
      gpu_job_confirmed:false,
      result_digest_present:false,
      bridge_result_retrieved:false,
      v100_cuda_verified:false,
      production_promoted:false,
      diagnostic_root_cause_available:true,
      diagnostic_limitation:"NO_BAIDU_JOB_ID_CONFIRMED_NO_GPU_RUNTIME_ATTESTATION"
    },
    runtime_quarantined:["paddle2.4_py3.7","paddle2.6_py3.10","paddle2.5_py3.10"],
    runtime_quarantine_evidence:{
      "paddle2.4_py3.7":{state:"QUARANTINED",reason:"THREE_LIVE_ACCEPTANCE_FAILURES_LATEST_FREE_CREDIT_INSUFFICIENT",live_e2e_failures:3,latest_task_id:"baidu-circleci-live-20260817p24c-sdk039",latest_sdk_version:"0.3.9",latest_failure_class:"BAIDU_COMPUTE_CREDIT_INSUFFICIENT",latest_bridge_stage:"aistudio_submit_returned",baidu_job_id_confirmed:false,v100_cuda_verified:false},
      "paddle2.6_py3.10":{state:"QUARANTINED",reason:"LIVE_E2E_FAILED"},
      "paddle2.5_py3.10":{state:"QUARANTINED",reason:"TWO_CONSECUTIVE_LIVE_E2E_FAILURES",live_e2e_failures:2,latest_circleci_state:"failure",latest_elapsed_seconds:195}
    },
    runtime_fallback_candidates:[],
    runtime_promotion_requires:["live_e2e","v100_cuda_verified","result_digest","bridge_result_retrieved"],
    automatic_candidate_execution:false,
    automatic_paid_upgrade:false,
    automatic_same_failure_retry:false,
    candidate_retest_policy:"blocked-until-free-coupon-credit-available-and-manual-acceptance",
    arbitrary_code:false,
    arbitrary_shell:false,
    input_transport:"ephemeral-ticket-task-manifest-pull",
    static_shared_secret_required:false,
    ephemeral_ticket:true,
    max_task_seconds:900,
    secret_echo:false
  };
}

function requireConfig(env){const token=str(env.CIRCLECI_API_TOKEN),project=str(env.CIRCLECI_PROJECT_SLUG),definition=str(env.CIRCLECI_PIPELINE_DEFINITION_ID);if(!token||!project||!definition)throw Object.assign(new Error("BAIDU_CIRCLECI_BRIDGE_NOT_CONFIGURED"),{status:503});return {token,project,definition,branch:str(env.CIRCLECI_CONFIG_BRANCH)||"main"}}
export async function triggerBaiduBridge(env,{op,task_id,baidu_job_id="",bridge_ticket}){const cfg=requireConfig(env),operation=str(op).toUpperCase();if(!ALLOWED_OPS.has(operation))throw Object.assign(new Error("BAIDU_BRIDGE_OPERATION_DENIED"),{status:400});const id=str(task_id);if(!/^[A-Za-z0-9._:-]{1,96}$/.test(id))throw Object.assign(new Error("BAIDU_BRIDGE_TASK_ID_INVALID"),{status:400});const job=str(baidu_job_id);if(job&&!/^[A-Za-z0-9._:-]{1,128}$/.test(job))throw Object.assign(new Error("BAIDU_BRIDGE_JOB_ID_INVALID"),{status:400});const ticket=str(bridge_ticket);if(!/^[A-Za-z0-9_-]{32,128}$/.test(ticket))throw Object.assign(new Error("BAIDU_BRIDGE_TICKET_INVALID"),{status:500});const sdkVersion=operation==="SDK_SELFTEST"?"0.3.9":"0.3.8";const body={definition_id:cfg.definition,config:{branch:cfg.branch},checkout:{branch:cfg.branch},parameters:{bridge_dispatch:true,bridge_op:operation,task_id:id,baidu_job_id:job,bridge_ticket:ticket,sdk_version:sdkVersion}};const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const r=await fetch(`${CIRCLE_API}/project/${encSlug(cfg.project)}/pipeline/run`,{method:"POST",headers:{"Circle-Token":cfg.token,"content-type":"application/json",accept:"application/json"},body:JSON.stringify(body),signal:c.signal});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{}if(!r.ok)throw Object.assign(new Error(`CIRCLECI_HTTP_${r.status}`),{status:r.status>=500?502:r.status,details:{circle_status:r.status}});return {ok:true,pipeline_id:str(data.id)||null,pipeline_number:Number(data.number||0)||null,state:str(data.state)||"created",sdk_version:sdkVersion}}catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("CIRCLECI_TRIGGER_TIMEOUT"),{status:504});throw e}finally{clearTimeout(timer)}}
export async function digestBridgeTicket(ticket){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str(ticket)));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function newBridgeTicket(){const b=new Uint8Array(32);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
export function normalizeBaiduInput(input={}){const clamp=(v,a,b,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,Math.trunc(n))):d};return{matrix_size:clamp(input.matrix_size,256,2048,1024),rounds:clamp(input.rounds,1,5,2),seed:clamp(input.seed,1,2147483647,20260815)}}
