import {WorkflowEntrypoint} from "cloudflare:workers";
import {prepareModelScopeStudioLite,deployModelScopeStudioLite,getModelScopeStudioLiteStatus,stopModelScopeStudioLite} from "./modelscope-studio-lite.js";
import {clearModelScopeStudioLiteTask,getModelScopeStudioLiteTaskStatus} from "./modelscope-studio-task.js";

const TARGET="platform/2v-cpu-16g-mem";
const REVISION="studio-lite-runtime-v3-20260820";
const TASK_OPS=new Set(["sum","stats","dot","matmul","linear_regression","monte_carlo_pi"]);
const ONE_ATTEMPT={retries:{limit:1,delay:"1 second"},timeout:"2 minutes"};
const STATUS_ATTEMPT={retries:{limit:1,delay:"1 second"},timeout:"45 seconds"};
const STOP_RETRY={retries:{limit:2,delay:"5 seconds",backoff:"linear"},timeout:"1 minute"};
const CLEANUP_ATTEMPT={retries:{limit:2,delay:"3 seconds",backoff:"linear"},timeout:"45 seconds"};
const err=(stage,r)=>new Error(`${stage}:${r?.error_class||r?.stage||"FAILED"}`);
const verifiedV3=s=>s?.runtime_e2e_verified===true&&s?.hardware?.name===TARGET&&s?.hardware?.resource_type==="free"&&s?.runtime_receipt?.revision===REVISION;

async function gateFetch(env,path,method="POST",body={}){if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return{ok:false,error:"CENTER_GATE_UNAVAILABLE"};const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));const response=await gate.fetch(new Request(`https://gate.internal${path}`,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)}));return{http_status:response.status,...await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function releaseGate(env,taskId){return gateFetch(env,"/release","POST",{task_id:taskId})}
async function cleanupTask(instance,step,taskId){
  const stopped=await step.do("stop Studio Lite after task",STOP_RETRY,async()=>{try{return await stopModelScopeStudioLite(instance.env)}catch(e){return{ok:false,error_class:`STOP_THROW_${String(e?.name||"ERROR")}`}}});
  const cleared=await step.do("clear Studio Lite task secret",CLEANUP_ATTEMPT,async()=>{try{return await clearModelScopeStudioLiteTask(instance.env)}catch(e){return{ok:false,error_class:`CLEAR_THROW_${String(e?.name||"ERROR")}`}}});
  const released=await step.do("release ModelScope compute gate",CLEANUP_ATTEMPT,async()=>{try{return await releaseGate(instance.env,taskId)}catch(e){return{ok:false,error:`RELEASE_THROW_${String(e?.name||"ERROR")}`}}});
  return{stopped,cleared,released,ok:stopped?.ok===true&&cleared?.ok===true&&released?.ok===true};
}

async function runTaskWorkflow(instance,event,step){
  const taskId=String(event?.payload?.task_id||""),op=String(event?.payload?.op||"");
  if(!/^[A-Za-z0-9_][A-Za-z0-9_-]{5,99}$/.test(taskId)||!TASK_OPS.has(op))throw new Error("task-validate:INVALID_WORKFLOW_TASK_METADATA");
  let prepared=null,deployed=null,taskStatus=null,failure=null;
  try{
    prepared=await step.do("prepare task-capable Studio Lite",ONE_ATTEMPT,async()=>{const r=await prepareModelScopeStudioLite(instance.env);if(r?.ok!==true)throw err("prepare",r);if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("prepare:FREE_TARGET_MISMATCH");return r});
    deployed=await step.do("deploy Studio Lite task",ONE_ATTEMPT,async()=>{const r=await deployModelScopeStudioLite(instance.env);if(r?.ok!==true)throw err("deploy",r);if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("deploy:FREE_TARGET_MISMATCH");return r},{rollback:async()=>{await stopModelScopeStudioLite(instance.env)},rollbackConfig:STOP_RETRY});
    for(let i=0;i<8;i++){await step.sleep(`wait for Studio task ${i+1}`,"30 seconds");const status=await step.do(`inspect Studio task receipt ${i+1}`,STATUS_ATTEMPT,async()=>getModelScopeStudioLiteTaskStatus(instance.env,taskId));if(status?.completed===true){taskStatus=status;break}}
    if(!taskStatus)throw new Error("task-verify:MODELSCOPE_TASK_RECEIPT_TIMEOUT");if(taskStatus.ok!==true)throw err("task-execute",taskStatus);
  }catch(e){failure=String(e?.message||e||"TASK_WORKFLOW_FAILED")}
  const cleanup=await cleanupTask(instance,step,taskId);
  if(!cleanup.ok){const parts=[];if(cleanup.stopped?.ok!==true)parts.push("stop");if(cleanup.cleared?.ok!==true)parts.push("secret");if(cleanup.released?.ok!==true)parts.push("gate");const cleanupFailure=`cleanup:FAILED=${parts.join(",")}`;failure=failure?`${failure};${cleanupFailure}`:cleanupFailure}
  if(failure)throw new Error(failure);if(!prepared||!deployed||!taskStatus)throw new Error("task-workflow:INCOMPLETE_STATE");
  return{ok:true,stage:"task-completed",runner:"modelscope-studio-lite-workflow",workflow_instance_id:event.instanceId,task_id:taskId,op,task_receipt:taskStatus.task_receipt,target_hardware:TARGET,resource_type:"free",stopped:{http_status:cleanup.stopped?.stop_http_status||null},task_secret_cleared:cleanup.cleared?.ok===true,gate_released:cleanup.released?.ok===true,polling_rounds_max:8,polling_sleep_seconds:30,workflow_payload_contains_task_values:false,arbitrary_code:false,free_only:true,paid_fallback:false,secrets_redacted:true};
}

export class ModelScopeStudioLiteWorkflow extends WorkflowEntrypoint{
  async run(event,step){
    if(event?.payload?.mode==="task")return runTaskWorkflow(this,event,step);
    const prior=await step.do("check prior verified Studio receipt",STATUS_ATTEMPT,async()=>getModelScopeStudioLiteStatus(this.env));
    if(verifiedV3(prior)){const stopped=await step.do("ensure previously verified Studio is stopped",STOP_RETRY,async()=>{const s=await stopModelScopeStudioLite(this.env);if(s?.ok!==true)throw err("stop-prior",s);return s});return{ok:true,stage:"already-verified",runner:"modelscope-studio-lite-workflow",workflow_instance_id:event.instanceId,target_hardware:TARGET,resource_type:"free",runtime_receipt:prior.runtime_receipt,stopped:{http_status:stopped.stop_http_status||null},subrequest_budget_max:50,polling_rounds_max:8,polling_sleep_seconds:30,free_only:true,paid_fallback:false,secrets_redacted:true}}
    let prepared=null,deployed=null,verified=null,failure=null,stopped=null;
    try{prepared=await step.do("prepare Studio Lite",ONE_ATTEMPT,async()=>{const r=await prepareModelScopeStudioLite(this.env);if(r?.ok!==true)throw err("prepare",r);if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("prepare:FREE_TARGET_MISMATCH");return r});deployed=await step.do("deploy Studio Lite",ONE_ATTEMPT,async()=>{const r=await deployModelScopeStudioLite(this.env);if(r?.ok!==true)throw err("deploy",r);if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("deploy:FREE_TARGET_MISMATCH");return r},{rollback:async()=>{const s=await stopModelScopeStudioLite(this.env);if(s?.ok!==true)throw err("rollback-stop",s)},rollbackConfig:STOP_RETRY});for(let i=0;i<8;i++){await step.sleep(`wait for Studio runtime ${i+1}`,"30 seconds");const s=await step.do(`inspect Studio receipt ${i+1}`,STATUS_ATTEMPT,async()=>getModelScopeStudioLiteStatus(this.env));if(verifiedV3(s)){verified=s;break}}if(!verified)throw new Error("verify:MODELSCOPE_STUDIO_LITE_RUNTIME_E2E_FAILED")}catch(e){failure=String(e?.message||e||"WORKFLOW_FAILED")}
    if(prepared){stopped=await step.do("stop Studio Lite",STOP_RETRY,async()=>{const s=await stopModelScopeStudioLite(this.env);if(s?.ok!==true)throw err("stop",s);return s})}if(failure)throw new Error(failure);if(!prepared||!deployed||!verified||!stopped)throw new Error("workflow:INCOMPLETE_STATE");return{ok:true,stage:"runtime-verified",runner:"modelscope-studio-lite-workflow",workflow_instance_id:event.instanceId,target_hardware:TARGET,resource_type:"free",runtime_receipt:verified.runtime_receipt,prepared:{studio_created:prepared.studio_created===true,upload_action:prepared.upload_action||null},deployed:{http_status:deployed.deploy_http_status||null},stopped:{http_status:stopped.stop_http_status||null},subrequest_budget_max:50,polling_rounds_max:8,polling_sleep_seconds:30,free_only:true,paid_fallback:false,secrets_redacted:true};
  }
}
