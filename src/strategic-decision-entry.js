import app,{CenterGate,ModelScopeStudioLiteWorkflow} from "./admin-entry.js";
import {strategicDecisionRoute} from "./strategic-decision-science.js";
export {CenterGate,ModelScopeStudioLiteWorkflow};
export default{
  async fetch(req,env,ctx){
    try{const routed=await strategicDecisionRoute(req);if(routed)return routed}catch(error){return Response.json({ok:false,error:String(error?.message||error).slice(0,180),message:"Strategic decision-science request failed"},{status:error?.status||500,headers:{"cache-control":"no-store"}})}
    return app.fetch(req,env,ctx);
  },
  async scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
