import production,{CenterGate} from "./production.js";
import {maybeHandleBaiduCircleCI} from "./baidu-circleci-router.js";
export {CenterGate};

export default {
  async fetch(req,env,ctx){
    const handled=await maybeHandleBaiduCircleCI(req,env);
    if(handled)return handled;
    return production.fetch(req,env,ctx);
  }
};
