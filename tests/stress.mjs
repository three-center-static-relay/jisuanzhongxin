import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
let enteredResolve=()=>{},releaseResolve=()=>{},entered=Promise.resolve(),release=Promise.resolve();
function arm(){entered=new Promise(r=>{enteredResolve=r});release=new Promise(r=>{releaseResolve=r})}
function go(){releaseResolve()}
function taskId(slug){return String(slug||"").replace(/^three-center-(?:cpu|t4)-/,"")}
const network=setupServer(
  http.post("https://api.kaggle.com/v1/security.OAuthService/IntrospectToken",()=>HttpResponse.json({active:true,username:"stress-user",userId:1,scope:"read write"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/SaveKernel",async({request})=>{const b=await request.json(),t=String(b?.newTitle||"");if(t.includes("compute-holder")||t.includes("compute-duplicate")){enteredResolve();await release;}return HttpResponse.json({ref:b.slug,versionNumber:1,url:`https://www.kaggle.com/code/${b.slug}`});}),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/GetKernelSessionStatus",()=>HttpResponse.json({status:"COMPLETE"})),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/ListKernelSessionOutput",async({request})=>{const b=await request.json(),id=taskId(b?.kernelSlug);return HttpResponse.json({log:`THREE_CENTER_RESULT:${JSON.stringify({ok:true,task_id:id,profile:"core",accelerator:"cpu",pi:3.14,linear_residual:0})}`,files:[]});}),
  http.post("https://api.kaggle.com/v1/kernels.KernelsApiService/DeleteKernel",()=>HttpResponse.json({ok:true}))
);network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
const BASE="https://compute.internal";
async function post(path,body){const r=await server.fetch(`${BASE}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id){return post("/v1/run",{task_id:id,profile:"core",input:{},timeout_seconds:60})}
async function reset(){await server.reset();enteredResolve=()=>{};releaseResolve=()=>{};entered=Promise.resolve();release=Promise.resolve()}
let exitCode=0;
try{
  await server.listen();
  await reset();arm();const first=run("compute-holder");await within(entered,5000,"holder-enter");const contenders=await within(Promise.all(Array.from({length:64},(_,i)=>run(`compute-contender-${i}`))),12000,"contenders");assert.equal(contenders.filter(x=>x.status===409&&x.body?.error==="BUSY").length,64);go();assert.equal((await within(first,5000,"holder-finish")).status,202);
  await reset();arm();const dupFirst=run("compute-duplicate");await within(entered,5000,"dup-enter");const dup=await within(Promise.all(Array.from({length:64},()=>run("compute-duplicate"))),12000,"duplicates");assert.equal(dup.filter(x=>x.status===409&&x.body?.error==="DUPLICATE_TASK").length,64);go();assert.equal((await within(dupFirst,5000,"dup-finish")).status,202);
  await reset();assert.equal((await run("running-id")).status,202);assert.equal((await run("blocked-while-running")).status,409);const st=await post("/v1/status",{task_id:"running-id"});assert.equal(st.status,200);assert.equal(st.body?.ok,true);assert.equal(st.body?.status,"completed");assert.equal((await run("after-status-release")).status,202);
  console.log(JSON.stringify({ok:true,suite:"compute-stress-stage-b",concurrency_contenders:64,duplicate_contenders:64,tests:["official-api-dispatch","single-lock","duplicate-id","running-lock","terminal-status-release"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await server.close()}catch{}network.close();process.exit(exitCode);
