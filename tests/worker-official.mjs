import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
const api="https://api.kaggle.com/v1",jobs=new Map(),deleted=[];let cancelCalls=0;
function sourceMeta(text){const tm=text.match(/"task_id":("(?:[^"\\]|\\.)*")/),pm=text.match(/"profile":("(?:[^"\\]|\\.)*")/);return{task_id:tm?JSON.parse(tm[1]):"unknown",profile:pm?JSON.parse(pm[1]):"core"}}
const network=setupServer(
  http.post(`${api}/security.OAuthService/IntrospectToken`,()=>HttpResponse.json({active:true,username:"tester",userId:1,scope:"read write"})),
  http.post(`${api}/kernels.KernelsApiService/SaveKernel`,async({request})=>{const b=await request.json(),m=sourceMeta(b.text),gpu=b.machineShape==="NvidiaTeslaT4";assert.equal(b.isPrivate,true);assert.equal(b.enableInternet,false);assert.ok(!b.text.includes("EVIL_USER_CODE"));jobs.set(b.slug,{...m,gpu,status:m.task_id.includes("cancel")?"RUNNING":m.task_id.includes("fail")?"ERROR":"COMPLETE"});return HttpResponse.json({ref:b.slug,url:`https://www.kaggle.com/code/${b.slug}`,versionNumber:1})}),
  http.post(`${api}/kernels.KernelsApiService/GetKernelSessionStatus`,async({request})=>{const b=await request.json(),j=jobs.get(`${b.userName}/${b.kernelSlug}`);if(!j)return HttpResponse.json({status:"ERROR",failureMessage:"missing"});return HttpResponse.json({status:j.status,failureMessage:j.status==="ERROR"?"synthetic failure":""})}),
  http.post(`${api}/kernels.KernelsApiService/ListKernelSessionOutput`,async({request})=>{const b=await request.json(),j=jobs.get(`${b.userName}/${b.kernelSlug}`);const result=j.gpu?{ok:true,task_id:j.task_id,profile:j.profile,accelerator:"t4",cuda:true,device:"Tesla T4",relative_error:0.001,matrix_checksum:"a".repeat(64)}:{ok:true,task_id:j.task_id,profile:j.profile,accelerator:"cpu",pi:3.1415,linear_residual:1e-12,matrix_checksum:"b".repeat(64)};return HttpResponse.json({files:[{fileName:"three-center-result.json",url:"https://signed.invalid/out"}],log:`THREE_CENTER_RESULT:${JSON.stringify(result)}\n`})}),
  http.post(`${api}/kernels.KernelsApiService/DeleteKernel`,async({request})=>{const b=await request.json();deleted.push(`${b.userName}/${b.kernelSlug}`);return HttpResponse.json({errorMessage:""})}),
  http.post("https://www.kaggle.com/mcp",async({request})=>{const b=await request.json();if(b.method==="initialize")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{protocolVersion:"2025-06-18",serverInfo:{name:"Kaggle.Web",version:"1"},capabilities:{tools:{}}}},{headers:{"mcp-session-id":"s1"}});if(b.method==="notifications/initialized")return new HttpResponse(null,{status:202});if(b.method==="tools/list")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{tools:[{name:"kernel_session_cancel",description:"Cancel running notebook kernel session",inputSchema:{type:"object",properties:{user_name:{type:"string"},kernel_slug:{type:"string"}},required:["user_name","kernel_slug"]}}]}});if(b.method==="tools/call"){cancelCalls++;const ref=`${b.params.arguments.user_name}/${b.params.arguments.kernel_slug}`,j=jobs.get(ref);if(j)j.status="CANCEL_ACKNOWLEDGED";return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{content:[{type:"text",text:"cancelled"}],isError:false}})}return HttpResponse.json({jsonrpc:"2.0",id:b.id,error:{code:-32601,message:"unknown"}})} )
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
const internal=p=>`https://compute.internal${p}`,external=p=>`https://public.example${p}`;
async function post(path,body,host="internal"){const r=await server.fetch(host==="internal"?internal(path):external(path),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
let code=0;
try{
  await server.listen();
  let r=await post("/v1/run",{task_id:"external",profile:"core"},"external");assert.equal(r.status,403);
  const h=await server.fetch(external("/health"));const hb=await h.json();assert.equal(h.status,200);assert.equal(hb.kaggle.bridge_required,false);assert.equal(hb.kaggle.kaggle_api_token_configured,true);
  r=await post("/v1/run",{task_id:"cpu-one",profile:"core",input:{matrix_size:256,code:"EVIL_USER_CODE"}});assert.equal(r.status,202);assert.equal(r.body.machine_shape,"cpu");
  let d=await post("/v1/run",{task_id:"cpu-one",profile:"core"});assert.equal(d.status,409);assert.equal(d.body.error,"DUPLICATE_TASK");
  let busy=await post("/v1/run",{task_id:"cpu-two",profile:"core"});assert.equal(busy.status,409);assert.equal(busy.body.error,"BUSY");
  let s=await post("/v1/status",{task_id:"cpu-one"});assert.equal(s.status,200);assert.equal(s.body.status,"completed");assert.equal(s.body.result.accelerator,"cpu");assert.equal(s.body.verification.ok,true);assert.equal(s.body.temporary_kernel_deleted,true);
  r=await post("/v1/run",{task_id:"gpu-one",profile:"gpu",gpu:true,input:{matrix_size:1024,rounds:2}});assert.equal(r.status,202);assert.equal(r.body.machine_shape,"NvidiaTeslaT4");s=await post("/v1/status",{task_id:"gpu-one"});assert.equal(s.status,200);assert.equal(s.body.result.accelerator,"t4");assert.match(s.body.result.device,/T4/i);assert.equal(s.body.verification.ok,true);
  r=await post("/v1/run",{task_id:"cancel-one",profile:"simulation"});assert.equal(r.status,202);let c=await post("/v1/cancel",{task_id:"cancel-one"});assert.equal(c.status,202);assert.equal(c.body.transport,"kaggle-official-mcp");assert.equal(c.body.lock_retained,true);s=await post("/v1/status",{task_id:"cancel-one"});assert.equal(s.status,200);assert.equal(s.body.status,"cancelled");assert.equal(cancelCalls,1);
  r=await post("/v1/run",{task_id:"fail-one",profile:"optimization"});assert.equal(r.status,202);s=await post("/v1/status",{task_id:"fail-one"});assert.equal(s.status,502);assert.equal(s.body.error,"UPSTREAM_TASK_FAILED");
  const self=await post("/v1/selftest",{});assert.equal(self.status,200);assert.equal(self.body.token_active,true);assert.equal(self.body.mcp_authenticated,true);assert.equal(self.body.mcp_cancel_tool_present,true);assert.equal(self.body.business_e2e,false);
  assert.ok(deleted.length>=4);
  console.log(JSON.stringify({ok:true,suite:"worker-official-lifecycle",tests:["external-execution-denied","health-no-bridge","cpu-run-result-cleanup","duplicate-rejected","busy-rejected","t4-run-result","mcp-cancel-lock-retained-until-terminal","failure-cleanup","live-control-selftest"]}));
}catch(e){code=1;try{server.debug()}catch{}console.error(e)}
try{await server.close()}catch{}network.close();process.exit(code);