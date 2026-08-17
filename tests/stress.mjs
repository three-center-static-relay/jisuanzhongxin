import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";

const HARD_TIMEOUT_MS=60000;
const watchdog=setTimeout(()=>{console.error("STRESS_WATCHDOG_TIMEOUT");process.exit(124)},HARD_TIMEOUT_MS);
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
let holdEnteredResolve=()=>{},holdReleaseResolve=()=>{},holdEntered=Promise.resolve(),holdRelease=Promise.resolve();
function armHold(){holdEntered=new Promise(r=>{holdEnteredResolve=r});holdRelease=new Promise(r=>{holdReleaseResolve=r})}
function letGo(){holdReleaseResolve()}
function resetHold(){holdEnteredResolve=()=>{};holdReleaseResolve=()=>{};holdEntered=Promise.resolve();holdRelease=Promise.resolve()}
function taskIdFromSlug(slug){return String(slug||"").replace(/^three-center-(?:cpu|t4)-/,"")}
function completedLog(slug){return `THREE_CENTER_RESULT:${JSON.stringify({ok:true,task_id:taskIdFromSlug(slug),profile:"core",accelerator:"cpu",pi:3.14,linear_residual:0})}`}

const network=setupServer(
  http.post("https://api.kaggle.com/v1/security.OAuthService/IntrospectToken",()=>HttpResponse.json({active:true,username:"stress-user",userId:1,scope:"read write"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/SaveKernel",async({request})=>{
    const b=await request.json(),title=String(b?.newTitle||"");
    if(title==="three-center-cpu-compute-holder"||title==="three-center-cpu-compute-duplicate"){holdEnteredResolve();await holdRelease;}
    if(title==="three-center-cpu-upstream-fail")return HttpResponse.json({message:"synthetic-upstream-failure"},{status:503});
    if(title==="three-center-cpu-oversize-dispatch")return HttpResponse.json({padding:"x".repeat(2_100_000)});
    return HttpResponse.json({ref:b.slug,versionNumber:1,url:`https://www.kaggle.com/code/${b.slug}`});
  }),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/GetKernelSessionStatus",async({request})=>{
    const b=await request.json(),slug=String(b?.kernelSlug||"");
    return HttpResponse.json({status:slug==="three-center-cpu-cancel-running"?"CANCELLED":"COMPLETE"});
  }),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/ListKernelSessionOutput",async({request})=>{
    const b=await request.json();return HttpResponse.json({log:completedLog(b?.kernelSlug),files:[]});
  }),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/DeleteKernel",()=>HttpResponse.json({ok:true})),
  http.post("https://www.kaggle.com/mcp",async({request})=>{
    const b=await request.json();
    if(b?.method==="initialize")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{protocolVersion:"2025-06-18",capabilities:{},serverInfo:{name:"kaggle",version:"test"}}},{headers:{"mcp-session-id":"stress-session"}});
    if(b?.method==="notifications/initialized")return HttpResponse.json({jsonrpc:"2.0",result:{}});
    if(b?.method==="tools/list")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{tools:[{name:"kernel_session_cancel",description:"Cancel kernel session",inputSchema:{type:"object",properties:{username:{type:"string"},kernelSlug:{type:"string"}},required:["username","kernelSlug"]}}]}});
    if(b?.method==="tools/call")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{content:[{type:"text",text:"cancel requested"}],isError:false}});
    return HttpResponse.json({jsonrpc:"2.0",id:b?.id||null,result:{}});
  })
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
const INTERNAL="https://compute.internal";
async function post(path,body,origin=INTERNAL){const r=await server.fetch(`${origin}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,profile="core",input={}){return post("/v1/run",{task_id:id,profile,input,timeout_seconds:60})}
async function reset(){await within(server.reset(),5000,"reset");resetHold()}

let exitCode=0;
try{
  await within(server.listen(),10000,"listen");

  await reset();
  const external=await post("/v1/run",{task_id:"external-denied",profile:"core"},"https://public.example");
  assert.equal(external.status,403);assert.equal(external.body?.error,"POLICY_DENIED");
  const badProfile=await run("bad-profile","arbitrary-shell");assert.equal(badProfile.status,400);assert.equal(badProfile.body?.error,"INVALID_REQUEST");
  const badProvider=await post("/v1/run",{task_id:"bad-provider",profile:"core",provider:"arbitrary"});assert.equal(badProvider.status,400);assert.equal(badProvider.body?.error,"INVALID_REQUEST");
  const big={task_id:"huge",profile:"core",input:{padding:"x".repeat(70000)}};
  const bigResponse=await server.fetch(`${INTERNAL}/v1/run`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(big)});assert.equal(bigResponse.status,413);

  await reset();armHold();
  const first=run("compute-holder");await within(holdEntered,5000,"holder-enter");
  const contenders=await within(Promise.all(Array.from({length:64},(_,i)=>run(`compute-contender-${i}`))),12000,"unique-contenders");
  assert.equal(contenders.filter(x=>x.status===409&&x.body?.error==="BUSY").length,64);
  letGo();assert.equal((await within(first,5000,"holder-finish")).status,202);

  await reset();armHold();
  const dupFirst=run("compute-duplicate");await within(holdEntered,5000,"duplicate-enter");
  const duplicates=await within(Promise.all(Array.from({length:64},()=>run("compute-duplicate"))),12000,"duplicate-contenders");
  assert.equal(duplicates.filter(x=>x.status===409&&x.body?.error==="DUPLICATE_TASK").length,64);
  letGo();assert.equal((await within(dupFirst,5000,"duplicate-finish")).status,202);

  await reset();
  assert.equal((await run("running-id")).status,202);
  assert.equal((await run("blocked-while-running")).status,409);
  const completed=await post("/v1/status",{task_id:"running-id"});
  assert.equal(completed.status,200);assert.equal(completed.body?.ok,true);assert.equal(completed.body?.status,"completed");
  assert.equal((await run("after-status-release")).status,202);

  await reset();
  const failed=await run("upstream-fail");assert.equal(failed.status,503);assert.equal(failed.body?.error,"synthetic-upstream-failure");
  assert.equal((await run("after-upstream-fail")).status,202);

  await reset();
  const oversized=await run("oversize-dispatch");assert.equal(oversized.status,502);assert.equal(oversized.body?.error,"KAGGLE_RESPONSE_TOO_LARGE");
  assert.equal((await run("after-oversize-dispatch")).status,202);

  await reset();
  assert.equal((await run("cancel-running")).status,202);
  const cancel=await post("/v1/cancel",{task_id:"cancel-running"});assert.equal(cancel.status,202);assert.equal(cancel.body?.lock_retained,true);
  assert.equal((await run("blocked-during-cancel")).status,409);
  const cancelled=await post("/v1/status",{task_id:"cancel-running"});assert.equal(cancelled.status,200);assert.equal(cancelled.body?.status,"cancelled");
  assert.equal((await run("after-cancel-release")).status,202);

  await reset();
  const burst=await within(Promise.all(Array.from({length:220},(_,i)=>run(`rate-${i}`,"invalid-profile"))),20000,"rate-burst");
  assert.equal(burst.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,20);
  assert.equal(burst.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);

  const health=await within(Promise.all(Array.from({length:256},()=>server.fetch(`${INTERNAL}/health`))),10000,"health-burst");
  assert.equal(health.filter(r=>r.status===200).length,256);

  console.log(JSON.stringify({ok:true,suite:"compute-stress-current-kaggle-control-plane",concurrency_contenders:64,duplicate_contenders:64,rate_burst:220,health_burst:256,tests:["internal-route-policy","single-lock","duplicate-id","running-lock","terminal-status-release","upstream-failure-release","official-api-response-size-cap","cancel-lock-retention","cancel-terminal-release","profile-deny","provider-deny","body-limit","rate-limit","read-burst"],fault_injection_exact_match:true,bridge_test_removed:true,kaggle_official_api_mocked:true,kaggle_mcp_mocked:true}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))])}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);
