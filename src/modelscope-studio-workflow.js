import {WorkflowEntrypoint} from "cloudflare:workers";
import {prepareModelScopeStudioLite,deployModelScopeStudioLite,getModelScopeStudioLiteStatus,stopModelScopeStudioLite} from "./modelscope-studio-lite.js";

const TARGET="platform/2v-cpu-16g-mem";
const REVISION="studio-lite-runtime-v2-20260817";
const STEP_RETRY={retries:{limit:1,delay:"5 seconds"},timeout:"2 minutes"};
const STOP_RETRY={retries:{limit:3,delay:"5 seconds",backoff:"linear"},timeout:"1 minute"};
const err=(stage,r)=>new Error(`${stage}:${r?.error_class||r?.stage||"FAILED"}`);

export class ModelScopeStudioLiteWorkflow extends WorkflowEntrypoint{
  async run(event,step){
    const prepared=await step.do("prepare Studio Lite",STEP_RETRY,async()=>{
      const r=await prepareModelScopeStudioLite(this.env);
      if(r?.ok!==true)throw err("prepare",r);
      if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("prepare:FREE_TARGET_MISMATCH");
      return r;
    });

    const deployed=await step.do(
      "deploy Studio Lite",
      STEP_RETRY,
      async()=>{
        const r=await deployModelScopeStudioLite(this.env);
        if(r?.ok!==true)throw err("deploy",r);
        if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("deploy:FREE_TARGET_MISMATCH");
        return r;
      },
      {
        rollback:async()=>{
          const s=await stopModelScopeStudioLite(this.env);
          if(s?.ok!==true)throw err("rollback-stop",s);
        },
        rollbackConfig:STOP_RETRY
      }
    );

    let verified=null;
    for(let i=0;i<6;i++){
      await step.sleep(`wait for Studio runtime ${i+1}`,"20 seconds");
      const s=await step.do(`inspect Studio receipt ${i+1}`,async()=>getModelScopeStudioLiteStatus(this.env));
      if(s?.runtime_e2e_verified===true&&s?.hardware?.name===TARGET&&s?.hardware?.resource_type==="free"){
        verified=s;
        break;
      }
    }
    if(!verified)throw new Error("verify:MODELSCOPE_STUDIO_LITE_RUNTIME_E2E_FAILED");
    if(verified?.runtime_receipt?.revision!==REVISION)throw new Error("verify:RUNTIME_REVISION_MISMATCH");

    const stopped=await step.do("stop Studio Lite after verified run",STOP_RETRY,async()=>{
      const s=await stopModelScopeStudioLite(this.env);
      if(s?.ok!==true)throw err("stop",s);
      return s;
    });

    return{
      ok:true,
      runner:"modelscope-studio-lite-workflow",
      workflow_instance_id:event.instanceId,
      target_hardware:TARGET,
      resource_type:"free",
      runtime_receipt:verified.runtime_receipt,
      prepared:{studio_created:prepared.studio_created===true,upload_action:prepared.upload_action||null},
      deployed:{http_status:deployed.deploy_http_status||null},
      stopped:{http_status:stopped.stop_http_status||null},
      free_only:true,
      paid_fallback:false,
      secrets_redacted:true
    };
  }
}
