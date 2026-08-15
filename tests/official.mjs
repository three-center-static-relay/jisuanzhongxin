import assert from "node:assert/strict";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
import {dispatch,getStatus,getOutput,removeKernel,officialMeta} from "../src/kaggle-official.js";
import {cancelKernel,probeMcp} from "../src/kaggle-mcp.js";
let saveBodies=[];
const api="https://api.kaggle.com/v1";
const server=setupServer(
  http.post(`${api}/security.OAuthService/IntrospectToken`,async({request})=>{assert.equal(request.headers.get("authorization"),"Bearer test-token");const b=await request.json();assert.equal(b.token,"test-token");return HttpResponse.json({active:true,username:"tester",userId:7,scope:"read write"})}),
  http.post(`${api}/kernels.KernelsApiService/SaveKernel`,async({request})=>{assert.equal(request.headers.get("authorization"),"Bearer test-token");const b=await request.json();saveBodies.push(b);return HttpResponse.json({ref:b.slug,url:`https://www.kaggle.com/code/${b.slug}`,versionNumber:3})}),
  http.post(`${api}/kernels.KernelsApiService/GetKernelSessionStatus`,async({request})=>{const b=await request.json();assert.equal(b.userName,"tester");return HttpResponse.json({status:"COMPLETE",failureMessage:""})}),
  http.post(`${api}/kernels.KernelsApiService/ListKernelSessionOutput`,()=>HttpResponse.json({files:[{fileName:"three-center-result.json",url:"https://example.invalid/signed"}],log:'noise\nTHREE_CENTER_RESULT:{"ok":true,"accelerator":"cpu","value":42}\n'})),
  http.post(`${api}/kernels.KernelsApiService/DeleteKernel`,()=>HttpResponse.json({errorMessage:""})),
  http.post("https://www.kaggle.com/mcp",async({request})=>{assert.equal(request.headers.get("authorization"),"Bearer test-token");const b=await request.json();if(b.method==="initialize")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{protocolVersion:"2025-06-18",serverInfo:{name:"Kaggle.Web",version:"1"},capabilities:{tools:{}}}},{headers:{"mcp-session-id":"s1"}});if(b.method==="notifications/initialized")return new HttpResponse(null,{status:202});if(b.method==="tools/list")return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{tools:[{name:"kernel_session_cancel",description:"Cancel a running Kaggle notebook kernel session",inputSchema:{type:"object",properties:{user_name:{type:"string"},kernel_slug:{type:"string"}},required:["user_name","kernel_slug"]}},{name:"datasets_list",description:"List datasets",inputSchema:{type:"object",properties:{}}}]}});if(b.method==="tools/call"){assert.equal(b.params.name,"kernel_session_cancel");assert.deepEqual(b.params.arguments,{user_name:"tester",kernel_slug:"three-center-unit"});return HttpResponse.json({jsonrpc:"2.0",id:b.id,result:{content:[{type:"text",text:"cancelled"}],isError:false}})}return HttpResponse.json({jsonrpc:"2.0",id:b.id,error:{code:-32601,message:"unknown"}})} )
);
server.listen({onUnhandledRequest:"error"});
const env={KAGGLE_API_TOKEN:"test-token"};
try{
  const cpu=await dispatch(env,{task_id:"unit-cpu",profile:"core",gpu:false,timeout_seconds:300,input:{matrix_size:256,monte_carlo_samples:100000,code:"print('INJECTION')"}});
  assert.equal(cpu.status,"running");assert.equal(cpu.user_name,"tester");assert.equal(cpu.machine_shape,"cpu");
  assert.equal(saveBodies[0].isPrivate,true);assert.equal(saveBodies[0].enableInternet,false);assert.equal(saveBodies[0].kernelType,"script");assert.ok(!saveBodies[0].text.includes("INJECTION"));assert.ok(saveBodies[0].text.includes("THREE_CENTER_RESULT:"));assert.ok(!("machineShape" in saveBodies[0]));
  const gpu=await dispatch(env,{task_id:"unit-gpu",profile:"gpu",gpu:true,timeout_seconds:300,input:{matrix_size:1024,rounds:2}});
  assert.equal(gpu.machine_shape,"NvidiaTeslaT4");assert.equal(saveBodies[1].machineShape,"NvidiaTeslaT4");assert.equal(saveBodies[1].enableInternet,false);assert.ok(saveBodies[1].text.includes("torch.cuda.is_available"));
  assert.deepEqual(await getStatus(env,cpu),{status:"completed",failure_message:""});
  const out=await getOutput(env,cpu);assert.equal(out.result.ok,true);assert.equal(out.result.value,42);assert.equal(out.log_digest.length,64);assert.equal(out.files[0].url_present,true);
  assert.equal(await removeKernel(env,cpu),true);assert.equal(officialMeta().bridge_required,false);assert.equal(officialMeta().arbitrary_code,false);
  const m=await probeMcp(env);assert.equal(m.ok,true);assert.equal(m.cancel_tool_present,true);assert.equal(m.notebook_tools,1);
  const cr=await cancelKernel(env,{user_name:"tester",kernel_slug:"three-center-unit"});assert.equal(cr.ok,true);assert.equal(cr.tool,"kernel_session_cancel");
  console.log(JSON.stringify({ok:true,suite:"kaggle-official-contract",tests:["bearer-auth","token-introspection","private-cpu-kernel","t4-machine-shape","internet-off","arbitrary-code-injection-ignored","status-normalization","output-sentinel","cleanup","mcp-tools-list","mcp-cancel"]}));
}finally{server.close()}