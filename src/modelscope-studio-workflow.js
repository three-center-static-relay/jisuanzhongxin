import {WorkflowEntrypoint} from "cloudflare:workers";
import {prepareModelScopeStudioLite,deployModelScopeStudioLite,getModelScopeStudioLiteStatus,stopModelScopeStudioLite} from "./modelscope-studio-lite.js";

const TARGET="platform/2v-cpu-16g-mem";
const REVISION="studio-lite-runtime-v2-20260817";
const ONE_ATTEMPT={retries:{limit:1,delay:"1 second"},timeout:"2 minutes"};
const STATUS_ATTEMPT={retries:{limit:1,delay:"1 second"},timeout:"45 seconds"};
const STOP_RETRY={retries:{limit:2,delay:"5 seconds",backoff:"linear"},timeout:"1 minute"};
const err=(stage,r)=>new Error(`${stage}:${r?.error_class||r?.stage||"FAILED"}`);
const verifiedV2=s=>s?.runtime_e2e_verified===true&&s?.hardware?.name===TARGET&&s?.hardware?.resource_type==="free"&&s?.runtime_receipt?.revision===REVISION;

export class ModelScopeStudioLiteWorkflow extends WorkflowEntrypoint{
  async run(event,step){
    const prior=await step.do("check prior verified Studio receipt",STATUS_ATTEMPT,async()=>getModelScopeStudioLiteStatus(this.env));
    if(verifiedV2(prior)){
      const stopped=await step.do("ensure previously verified Studio is stopped",STOP_RETRY,async()=>{
        const s=await stopModelScopeStudioLite(this.env);
        if(s?.ok!==true)throw err("stop-prior",s);
        return s;
      });
      return{
        ok:true,
        stage:"already-verified",
        runner:"modelscope-studio-lite-workflow",
        workflow_instance_id:event.instanceId,
        target_hardware:TARGET,
        resource_type:"free",
        runtime_receipt:prior.runtime_receipt,
        stopped:{http_status:stopped.stop_http_status||null},
        subrequest_budget_max:50,
        polling_rounds_max:5,
        free_only:true,
        paid_fallback:false,
        secrets_redacted:true
      };
    }

    let prepared=null,deployed=null,verified=null,failure=null,stopped=null;
    try{
      prepared=await step.do("prepare Studio Lite",ONE_ATTEMPT,async()=>{
        const r=await prepareModelScopeStudioLite(this.env);
        if(r?.ok!==true)throw err("prepare",r);
        if(r?.hardware?.name!==TARGET||r?.hardware?.resource_type!=="free")throw new Error("prepare:FREE_TARGET_MISMATCH");
        return r;
      });

      deployed=await step.do(
        "deploy Studio Lite",
        ONE_ATTEMPT,
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

      for(let i=0;i<5;i++){
        await step.sleep(`wait for Studio runtime ${i+1}`,"20 seconds");
        const s=await step.do(`inspect Studio receipt ${i+1}`,STATUS_ATTEMPT,async()=>getModelScopeStudioLiteStatus(this.env));
        if(verifiedV2(s)){
          verified=s;
          break;
        }
      }
      if(!verified)throw new Error("verify:MODELSCOPE_STUDIO_LITE_RUNTIME_E2E_FAILED");
    }catch(e){
      failure=String(e?.message||e||"WORKFLOW_FAILED");
    }

    if(prepared){
      stopped=await step.do("stop Studio Lite",STOP_RETRY,async()=>{
        const s=await stopModelScopeStudioLite(this.env);
        if(s?.ok!==true)throw err("stop",s);
        return s;
      });
    }

    if(failure)throw new Error(failure);
    if(!prepared||!deployed||!verified||!stopped)throw new Error("workflow:INCOMPLETE_STATE");

    return{
      ok:true,
      stage:"runtime-verified",
      runner:"modelscope-studio-lite-workflow",
      workflow_instance_id:event.instanceId,
      target_hardware:TARGET,
      resource_type:"free",
      runtime_receipt:verified.runtime_receipt,
      prepared:{studio_created:prepared.studio_created===true,upload_action:prepared.upload_action||null},
      deployed:{http_status:deployed.deploy_http_status||null},
      stopped:{http_status:stopped.stop_http_status||null},
      subrequest_budget_max:50,
      polling_rounds_max:5,
      free_only:true,
      paid_fallback:false,
      secrets_redacted:true
    };
  }
}
