import e,{CenterGate} from "./production-entry-baidu-e2e-e.js";
import d from "./production-entry-baidu-fetch-once.js";
export {CenterGate};

const D_PREFIX="/__acceptance/baidu-existing-v100-20260815d";

export default {
  async fetch(req,env,ctx){
    const path=new URL(req.url).pathname;
    if(path===D_PREFIX||path.startsWith(D_PREFIX+"/"))return d.fetch(req,env,ctx);
    return e.fetch(req,env,ctx);
  }
};
