import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
const HARD_TIMEOUT_MS=50000;
const watchdog=setTimeout(()=>{console.error("STRESS_WATCHDOG_TIMEOUT");process.exit(124)},HARD_TIMEOUT_MS);
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
let holdEnteredResolve=()=>{},holdReleaseResolve=()=>{},holdEntered=Promise.resolve(),holdRelease=Promise.resolve();
function armHold(){holdEntered=new Promise(r=>{holdEnteredResolve=r});holdRelease=new Promise(r=>{holdReleaseResolve=r})}
function letGo(){holdReleaseResolve()}
const huge=()=>({status:"completed",terminal:true,padding:"x".repeat(1600000)});
const network=setupServer(
  http.post("https://bridge.test/dispatch",async({request})=>{const b=await request.json(),scenario=b?.input?.scenario||"terminal";if(scenario==="hold"){holdEnteredResolve();await holdRelease;return HttpResponse.json({status:"completed",terminal:true,result:{ok:true}})}if(scenario==="running")return HttpResponse.json({status:"running",status_url:`https://bridge.test/status/${b.task_id}`,cancel_url:`https://bridge.test/cancel/${b.task_id}`},{status:202});if(scenario==="cross-origin")return HttpResponse.json({status:"running",status_url:"https://evil.test/status",cancel_url:`https://bridge.test/cancel/${b.task_id}`},{status:202});if(scenario==="upstream-503")return HttpResponse.json({error:"synthetic-bridge-failure"},{status:503});if(scenario==="oversize")return HttpResponse.json(huge());return HttpResponse.json({status:"completed",terminal:true,result:{profile:b.profile,gpu:b.gpu}})}),
  http.get("https://bridge.test/status/:id",({params})=>String(params.id)==="oversize-status"?HttpResponse.json(huge()):HttpResponse.json({status:"completed",terminal:true,task_id:String(params.id),result:{ok:true}})),
  http.post("https://bridge.test/cancel/:id",({params})=>String(params.id)==="oversize-cancel"?HttpResponse.json(huge()):HttpResponse.json({status:"cancelled",terminal:true,task_id:String(params.id)}))
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
async function post(path,body){const r=await server.fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,scenario="terminal",profile="core"){return post("/v1/run",{task_id:id,profile,input:{scenario},timeout_seconds:60})}
async function reset(){await within(server.reset(),5000,"reset");holdEnteredResolve=()=>{};holdReleaseResolve=()=>{};holdEntered=Promise.resolve();holdRelease=Promise.resolve()}
let exitCode=0;
try{
  await within(server.listen(),10000,"listen");
  await reset();armHold();const first=run("compute-holder","hold");await within(holdEntered,5000,"holder-enter");const contenders=await within(Promise.all(Array.from({length:64},(_,i)=>run(`compute-contender-${i}`))),10000,"unique-contenders");assert.equal(contenders.filter(x=>x.status===409&&x.body?.error==="BUSY").length,64);letGo();assert.equal((await within(first,5000,"holder-finish")).status,200);
  await reset();armHold();const dupFirst=run("compute-duplicate","hold");await within(holdEntered,5000,"dup-enter");const dup=await within(Promise.all(Array.from({length:64},()=>run("compute-duplicate"))),10000,"duplicate-contenders");assert.equal(dup.filter(x=>x.status===409&&["DUPLICATE_TASK","BUSY"].includes(x.body?.error)).length,64);letGo();assert.equal((await within(dupFirst,5000,"dup-finish")).status,200);
  await reset();const running=await run("running-id","running");assert.equal(running.status,202);assert.equal((await run("blocked-while-running")).status,409);const st=await post("/v1/status",{task_id:"running-id"});assert.equal(st.status,200);assert.equal(st.body?.lock_released,true);assert.equal((await run("after-status-release")).status,200);
  await reset();const cross=await run("cross-origin-id","cross-origin");assert.equal(cross.status,502);assert.equal(cross.body?.error,"POLICY_DENIED");assert.equal((await run("after-cross-origin")).status,200);
  await reset();const unavailable=await run("bridge-fail","upstream-503");assert.equal(unavailable.status,503);assert.equal(unavailable.body?.error,"UPSTREAM_UNAVAILABLE");assert.equal((await run("after-bridge-fail")).status,200);
  await reset();const oversized=await run("oversize-dispatch","oversize");assert.equal(oversized.status,502);assert.equal(oversized.body?.error,"UPSTREAM_RESPONSE_TOO_LARGE");assert.equal((await run("after-oversize-dispatch")).status,200);
  await reset();assert.equal((await run("oversize-status","running")).status,202);const os=await post("/v1/status",{task_id:"oversize-status"});assert.equal(os.status,502);assert.equal(os.body?.error,"UPSTREAM_RESPONSE_TOO_LARGE");assert.equal((await post("/v1/cancel",{task_id:"oversize-status"})).status,202);assert.equal((await run("after-oversize-status")).status,200);
  await reset();assert.equal((await run("oversize-cancel","running")).status,202);const oc=await post("/v1/cancel",{task_id:"oversize-cancel"});assert.equal(oc.status,502);assert.equal(oc.body?.error,"UPSTREAM_RESPONSE_TOO_LARGE");const recovered=await post("/v1/status",{task_id:"oversize-cancel"});assert.equal(recovered.status,200);assert.equal(recovered.body?.lock_released,true);assert.equal((await run("after-oversize-cancel")).status,200);
  await reset();const toCancel=await run("cancel-running","running");assert.equal(toCancel.status,202);const cancel=await post("/v1/cancel",{task_id:"cancel-running"});assert.equal(cancel.status,202);assert.equal(cancel.body?.lock_retained,false);assert.equal((await run("after-cancel-release")).status,200);
  await reset();const badProfile=await run("bad-profile","terminal","arbitrary-shell");assert.equal(badProfile.status,400);assert.equal(badProfile.body?.error,"INVALID_REQUEST");const big={task_id:"huge",profile:"core",input:{padding:"x".repeat(70000)}};const hr=await server.fetch("/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(big)});assert.equal(hr.status,413);
  await reset();const burst=await within(Promise.all(Array.from({length:220},(_,i)=>run(`rate-${i}`,"terminal","invalid-profile"))),15000,"rate-burst");assert.equal(burst.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,20);assert.equal(burst.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);
  const health=await within(Promise.all(Array.from({length:256},()=>server.fetch("/health"))),10000,"health-burst");assert.equal(health.filter(r=>r.status===200).length,256);
  console.log(JSON.stringify({ok:true,suite:"compute-stress",concurrency_contenders:64,duplicate_contenders:64,rate_burst:220,health_burst:256,tests:["single-lock","duplicate-id","running-lock","status-release","same-origin-control","cross-origin-deny","upstream-failure-release","dispatch-size-cap","status-size-cap","cancel-size-cap","cancel-release","profile-deny","body-limit","rate-limit","read-burst"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))])}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);
