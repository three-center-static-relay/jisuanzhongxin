import assert from "node:assert/strict";
import {http,HttpResponse} from "msw";
import {setupServer} from "msw/node";
import {dispatch,getStatus,getOutput,removeKernel,officialMeta} from "../src/kaggle-official.js";
let saveBodies=[];
const api="https://api.kaggle.com/v1";
const server=setupServer(
  http.post(`${api}/security.OAuthService/IntrospectToken`,async({request})=>{assert.equal(request.headers.get("authorization"),"Bearer test-token");const b=await request.json();assert.equal(b.token,"test-token");return HttpResponse.json({active:true,username:"tester",userId:7,scope:"read write"})}),
  http.post(`${api}/kernels.KernelsApiService/SaveKernel`,async({request})=>{assert.equal(request.headers.get("authorization"),"Bearer test-token");const b=await request.json();saveBodies.push(b);return HttpResponse.json({ref:b.slug,url:`https://www.kaggle.com/code/${b.slug}`,versionNumber:3})}),
  http.post(`${api}/kernels.KernelsApiService/GetKernelSessionStatus`,async({request})=>{const b=await request.json();assert.equal(b.userName,"tester");return HttpResponse.json({status:"COMPLETE",failureMessage:""})}),
  http.post(`${api}/kernels.KernelsApiService/ListKernelSessionOutput`,()=>HttpResponse.json({files:[{fileName:"three-center-result.json",url:"https://example.invalid/signed"}],log:'noise\nTHREE_CENTER_RESULT:{"ok":true,"accelerator":"cpu","value":42}\n'})),
  http.post(`${api}/kernels.KernelsApiService/DeleteKernel`,()=>HttpResponse.json({errorMessage:""}))
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
  console.log(JSON.stringify({ok:true,suite:"kaggle-official-contract",tests:["bearer-auth","token-introspection","private-cpu-kernel","t4-machine-shape","internet-off","arbitrary-code-injection-ignored","status-normalization","output-sentinel","cleanup"]}));
}finally{server.close()}