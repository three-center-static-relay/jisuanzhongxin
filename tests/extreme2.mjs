import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
const watchdog=setTimeout(()=>{console.error("COMPUTE_EXTREME2_WATCHDOG_TIMEOUT");process.exit(124)},100000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
async function waves(total,width,fn,label){const out=[];for(let base=0;base<total;base+=width){const part=await within(Promise.all(Array.from({length:Math.min(width,total-base)},(_,i)=>fn(base+i))),12000,`${label}-${base}`);out.push(...part)}return out}
let dispatchCalls=0,holdEnteredResolve=()=>{},holdReleaseResolve=()=>{},holdEntered=Promise.resolve(),holdRelease=Promise.resolve();
function armHold(){holdEntered=new Promise(r=>{holdEnteredResolve=r});holdRelease=new Promise(r=>{holdReleaseResolve=r})}
function letGo(){holdReleaseResolve()}
const network=setupServer(
  http.post("https://bridge.test/dispatch",async({request})=>{dispatchCalls++;const b=await request.json(),scenario=b?.input?.scenario||"terminal";if(scenario==="hold"){holdEnteredResolve();await holdRelease;return HttpResponse.json({status:"completed",terminal:true,result:{ok:true}})}if(scenario==="running")return HttpResponse.json({status:"running",status_url:`https://bridge.test/status/${b.task_id}`,cancel_url:`https://bridge.test/cancel/${b.task_id}`},{status:202});if(scenario==="terminal-failed")return HttpResponse.json({status:"failed",terminal:true,error:"synthetic failure"});if(scenario==="terminal-cancelled")return HttpResponse.json({status:"cancelled",terminal:true});return HttpResponse.json({status:"completed",terminal:true,result:{profile:b.profile,gpu:b.gpu,timeout_seconds:b.timeout_seconds}})}),
  http.get("https://bridge.test/status/:id",({params})=>HttpResponse.json({status:"completed",terminal:true,task_id:String(params.id),result:{ok:true}})),
  http.post("https://bridge.test/cancel/:id",({params})=>HttpResponse.json({status:"cancelled",terminal:true,task_id:String(params.id)}))
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
async function post(path,body){const r=await server.fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,scenario="terminal",profile="core",timeoutSeconds=60,gpu=false){return post("/v1/run",{task_id:id,profile,input:{scenario},timeout_seconds:timeoutSeconds,gpu})}
async function reset(){await within(server.reset(),5000,"reset");dispatchCalls=0;holdEnteredResolve=()=>{};holdReleaseResolve=()=>{};holdEntered=Promise.resolve();holdRelease=Promise.resolve()}
let exitCode=0;
try{
  await within(server.listen(),10000,"listen");

  await reset();armHold();const holder=run("cx-holder","hold","core",300);await within(holdEntered,5000,"holder-enter");const unique=await within(Promise.all(Array.from({length:256},(_,i)=>run(`cx-u-${i}`))),25000,"256-unique");assert.equal(unique.filter(x=>x.status===409&&x.body?.error==="BUSY").length,199);assert.equal(unique.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,57);assert.equal(dispatchCalls,1);letGo();assert.equal((await within(holder,7000,"holder-finish")).status,200);assert.equal(dispatchCalls,1);

  await reset();armHold();const dupHolder=run("cx-dup","hold","core",300);await within(holdEntered,5000,"dup-enter");const dup=await within(Promise.all(Array.from({length:512},()=>run("cx-dup"))),30000,"512-duplicate");assert.equal(dup.filter(x=>x.status===409&&x.body?.error==="DUPLICATE_TASK").length,199);assert.equal(dup.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,313);assert.equal(dispatchCalls,1);letGo();assert.equal((await within(dupHolder,7000,"dup-finish")).status,200);

  await reset();const leaseHolder=await run("cx-lease","running","core",30);assert.equal(leaseHolder.status,202);await sleep(31000);const late=await run("cx-late");assert.equal(late.status,409);assert.equal(late.body?.error,"BUSY");assert.equal(dispatchCalls,1);const leaseStatus=await post("/v1/status",{task_id:"cx-lease"});assert.equal(leaseStatus.status,200);assert.equal(leaseStatus.body?.lock_released,true);assert.equal((await run("cx-after-lease-release")).status,200);

  await reset();const failed=await run("cx-terminal-fail","terminal-failed");assert.equal(failed.status,502);assert.equal(failed.body?.error,"UPSTREAM_TASK_FAILED");assert.equal((await run("cx-after-terminal-fail")).status,200);
  await reset();const cancelled=await run("cx-terminal-cancel","terminal-cancelled");assert.equal(cancelled.status,409);assert.equal(cancelled.body?.error,"UPSTREAM_TASK_CANCELLED");assert.equal((await run("cx-after-terminal-cancel")).status,200);

  await reset();for(const profile of ["core","bayesian","simulation","causal","finance","gis","gpu","optimization"]){const r=await run(`cx-profile-${profile}`,"terminal",profile,60,profile==="gpu");assert.equal(r.status,200);assert.equal(r.body?.upstream?.result?.profile,profile);assert.equal(Boolean(r.body?.upstream?.result?.gpu),profile==="gpu")}

  await reset();const running=await run("cx-running","running");assert.equal(running.status,202);assert.equal((await run("cx-blocked")).status,409);const st=await post("/v1/status",{task_id:"cx-running"});assert.equal(st.status,200);assert.equal(st.body?.lock_released,true);assert.equal((await run("cx-after-status")).status,200);

  await reset();const cRun=await run("cx-cancel","running");assert.equal(cRun.status,202);const cr=await post("/v1/cancel",{task_id:"cx-cancel"});assert.equal(cr.status,202);assert.equal(cr.body?.lock_retained,false);assert.equal((await run("cx-after-cancel")).status,200);

  await reset();const rate=await waves(2000,128,i=>post("/v1/run",{task_id:`cx-rate-${i}`,profile:"invalid"}),"rate");assert.equal(rate.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);assert.equal(rate.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,1800);assert.equal(dispatchCalls,0);
  const health=await waves(1024,128,()=>server.fetch("/health"),"health");assert.equal(health.filter(r=>r.status===200).length,1024);

  console.log(JSON.stringify({ok:true,suite:"compute-extreme2",unique_contenders:256,unique_busy:199,unique_rate_limited:57,duplicate_contenders:512,duplicate_rejected:199,duplicate_rate_limited:313,lease_boundary_seconds:31,profiles:8,rate_total:2000,health_total:1024,tests:["256-rate-plus-lock","512-rate-plus-duplicate","31s-running-lease-no-overlap","terminal-failure-not-completed","terminal-cancel-not-completed","all-profiles","status-release","cancel-release","2000-overload","1024-health-burst"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))])}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);