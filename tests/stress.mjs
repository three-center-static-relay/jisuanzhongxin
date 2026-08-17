import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
const network=setupServer(
  http.post("https://api.kaggle.com/v1/security.OAuthService/IntrospectToken",()=>HttpResponse.json({active:true,username:"stress-user",userId:1,scope:"read write"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/SaveKernel",()=>HttpResponse.json({message:"synthetic-upstream-failure"},{status:503}))
);network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
let exitCode=0;try{await server.listen();await server.reset();const r=await server.fetch("https://compute.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:"upstream-fail",profile:"core",input:{},timeout_seconds:60})});const b=await r.json();assert.equal(r.status,503);assert.equal(b?.error,"synthetic-upstream-failure");console.log(JSON.stringify({ok:true,suite:"compute-stress-upstream-error-only",http_status:r.status,error:b?.error}));}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}try{await server.close()}catch{}network.close();process.exit(exitCode);