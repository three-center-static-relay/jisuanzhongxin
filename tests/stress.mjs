import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
const network=setupServer(
  http.post("https://api.kaggle.com/v1/security.OAuthService/IntrospectToken",()=>HttpResponse.json({active:true,username:"stress-user",userId:1,scope:"read write"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/SaveKernel",async({request})=>{const b=await request.json(),t=String(b?.newTitle||"");if(t.includes("upstream-fail"))return HttpResponse.json({message:"synthetic-upstream-failure"},{status:503});if(t.includes("oversize-dispatch"))return HttpResponse.json({padding:"x".repeat(2_100_000)});return HttpResponse.json({ref:b.slug,versionNumber:1,url:`https://www.kaggle.com/code/${b.slug}`});})
);network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});const BASE="https://compute.internal";
async function run(id){const r=await server.fetch(`${BASE}/v1/run`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:id,profile:"core",input:{},timeout_seconds:60})});return{status:r.status,body:await r.json().catch(()=>null)}}
let exitCode=0;try{await server.listen();await server.reset();const f=await run("upstream-fail");assert.equal(f.status,503);assert.equal(f.body?.error,"synthetic-upstream-failure");assert.equal((await run("after-upstream-fail")).status,202);await server.reset();const o=await run("oversize-dispatch");assert.equal(o.status,502);assert.equal(o.body?.error,"KAGGLE_RESPONSE_TOO_LARGE");assert.equal((await run("after-oversize-dispatch")).status,202);console.log(JSON.stringify({ok:true,suite:"compute-stress-stage-c1",upstream_failure_release:true,response_size_cap:true}));}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}try{await server.close()}catch{}network.close();process.exit(exitCode);