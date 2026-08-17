import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
const network=setupServer(
  http.post("https://api.kaggle.com/v1/security.OAuthService/IntrospectToken",()=>HttpResponse.json({active:true,username:"stress-user",userId:1,scope:"read write"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/SaveKernel",async({request})=>{const b=await request.json(),t=String(b?.newTitle||"");if(t.includes("upstream-fail"))return HttpResponse.json({message:"synthetic-upstream-failure"},{status:503});if(t.includes("oversize-dispatch"))return HttpResponse.json({padding:"x".repeat(2_100_000)});return HttpResponse.json({ref:b.slug,versionNumber:1,url:`https://www.kaggle.com/code/${b.slug}`});}),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/GetKernelSessionStatus",async({request})=>{const b=await request.json();return HttpResponse.json({status:String(b?.kernelSlug||"").includes("cancel-running")?"CANCELLED":"COMPLETE"});}),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/ListKernelSessionOutput",async({request})=>{const b=await request.json(),id=String(b?.kernelSlug||"").replace(/^three-center-(?:cpu|t4)-/,"");return HttpResponse.json({log:`THREE_CENTER_RESULT:${JSON.stringify({ok:true,task_id:id,profile:"core",accelerator:"cpu",pi:3.14,linear_residual:0})}`,files:[]});}),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/DeleteKernel",()=>HttpResponse.json({ok:true})),
  http.post("https://www.kaggle.com/mcp",async({request})=>{const b=await request.json();if(b?.method==="initialize")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{protocolVersion:"2025-06-18",capabilities:{},serverInfo:{name:"kaggle",version:"test"}}},{headers:{"mcp-session-id":"stress-session"}});if(b?.method==="notifications/initialized")return HttpResponse.json({jsonrpc:"2.0",result:{}});if(b?.method==="tools/list")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{tools:[{name:"kernel_session_cancel",description:"Cancel kernel session",inputSchema:{type:"object",properties:{username:{type:"string"},kernelSlug:{type:"string"}},required:["username","kernelSlug"]}}]}});if(b?.method==="tools/call")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{content:[{type:"text",text:"cancel requested"}],isError:false}});return HttpResponse.json({jsonrpc:"2.0",id:b?.id||null,result:{}});})
);network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});const BASE="https://compute.internal";
async function post(path,body){const r=await server.fetch(`${BASE}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,profile="core"){return post("/v1/run",{task_id:id,profile,input:{},timeout_seconds:60})}
let exitCode=0;
try{
  await server.listen();
  await server.reset();const fail=await run("upstream-fail");assert.equal(fail.status,503);assert.equal(fail.body?.error,"synthetic-upstream-failure");assert.equal((await run("after-upstream-fail")).status,202);
  await server.reset();const over=await run("oversize-dispatch");assert.equal(over.status,502);assert.equal(over.body?.error,"KAGGLE_RESPONSE_TOO_LARGE");assert.equal((await run("after-oversize-dispatch")).status,202);
  await server.reset();assert.equal((await run("cancel-running")).status,202);const c=await post("/v1/cancel",{task_id:"cancel-running"});assert.equal(c.status,202);assert.equal(c.body?.lock_retained,true);assert.equal((await run("blocked-during-cancel")).status,409);const st=await post("/v1/status",{task_id:"cancel-running"});assert.equal(st.status,200);assert.equal(st.body?.status,"cancelled");assert.equal((await run("after-cancel-release")).status,202);
  await server.reset();const burst=await within(Promise.all(Array.from({length:220},(_,i)=>run(`rate-${i}`,"invalid-profile"))),20000,"rate-burst");assert.equal(burst.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,20);assert.equal(burst.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);
  console.log(JSON.stringify({ok:true,suite:"compute-stress-stage-c",rate_burst:220,tests:["upstream-failure-release","official-api-size-cap","cancel-lock-retention","cancel-terminal-release","rate-limit"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await server.close()}catch{}network.close();process.exit(exitCode);
