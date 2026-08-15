import production,{CenterGate} from "./production.js";
import {maybeHandleBaiduCircleCI} from "./baidu-circleci-router.js";
import {maybeHandleModels} from "./model-router.js";
import {medicalImagingMeta} from "./medical-imaging-toolkit.js";
export {CenterGate};

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(req.method==="GET"&&u.pathname==="/v1/toolkits/medical-imaging/meta")return Response.json({ok:true,...medicalImagingMeta()},{headers:{"cache-control":"no-store"}});
    const modelHandled=await maybeHandleModels(req,env);
    if(modelHandled)return modelHandled;
    const handled=await maybeHandleBaiduCircleCI(req,env);
    if(handled)return handled;
    return production.fetch(req,env,ctx);
  }
};
