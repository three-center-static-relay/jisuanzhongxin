import assert from "node:assert/strict";
import {extractKaggleResult,officialMeta as kaggleOfficialMeta} from "../src/kaggle-official.js";
import {baiduAIStudioMeta,probeBaiduAIStudio} from "../src/baidu-aistudio.js";
import {bceAuthorization,fixedBundle,baiduNativeMeta} from "../src/baidu-native.js";

const expected={ok:true,task_id:"cpu-001",profile:"core",accelerator:"cpu"};
const encoded=JSON.stringify(expected);
assert.deepEqual(extractKaggleResult(`THREE_CENTER_RESULT:${encoded}`),expected);
assert.deepEqual(extractKaggleResult(`[2026-08-15T00:00:00Z] stdout THREE_CENTER_RESULT:${encoded}\nfinished`),expected);
assert.deepEqual(extractKaggleResult(`THREE_CENTER_RESULT:${encoded}\nTHREE_CENTER_RESULT:{bad-json}`),expected);
assert.deepEqual(extractKaggleResult(`prefix THREE_CENTER_RESULT:{bad-json}\nnoise\nTHREE_CENTER_RESULT:${encoded}\ntrailer`),expected);
assert.equal(extractKaggleResult("ordinary log without result marker"),null);

const km=kaggleOfficialMeta();
assert.equal(km.bridge_required,false);
assert.equal(km.arbitrary_code,false);
assert.equal(km.machine_shapes.cpu,"cpu");
assert.equal(km.machine_shapes.gpu,"NvidiaTeslaT4");
assert.deepEqual(km.result_retrieval,["log-marker","output-file"]);

const meta=baiduAIStudioMeta();
assert.equal(meta.payment_mode,"coupon");
assert.equal(meta.acoin_allowed,false);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.arbitrary_paid_execution,false);
assert.equal(meta.daily_maintenance_required,false);
assert.equal(meta.daily_checkin_required,false);
assert.equal(meta.bonus_harvesting,false);
assert.equal(meta.route_eligible,false);
const nm=baiduNativeMeta();
assert.equal(nm.payment_mode,"coupon");
assert.equal(nm.acoin_allowed,false);
assert.equal(nm.paid_fallback,false);
assert.equal(nm.fixed_bundle_only,true);
assert.equal(nm.arbitrary_code,false);
assert.equal(nm.route_eligible,false);

const sample=await bceAuthorization({
  ak:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  sk:"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  method:"PUT",
  path:"/v1/test/myfolder/readme.txt",
  query:{partNumber:"9",uploadId:"a44cc9bab11cbd156984767aad637851"},
  headers:{
    host:"bj.bcebos.com",
    "content-length":"8",
    "content-md5":"NFzcPqhviddjRNnSOGo4rw==",
    "content-type":"text/plain",
    "x-bce-date":"2015-04-27T08:23:49Z"
  },
  timestamp:"2015-04-27T08:23:49Z",
  expires:1800,
  signedHeaderNames:null
});
assert.equal(sample.authorization,"bce-auth-v1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/2015-04-27T08:23:49Z/1800//d74a04362e6a848f5b39b15421cb449427f419c95a480fd6b8cf9fc783e2999e");
const bundle=fixedBundle("baidu-smoke-001");
assert.equal(bundle[0],0x50);assert.equal(bundle[1],0x4b);assert.equal(bundle[2],0x03);assert.equal(bundle[3],0x04);
assert.ok(bundle.length>200);
assert.ok(new TextDecoder().decode(bundle).includes("run.py"));
assert.ok(new TextDecoder().decode(bundle).includes("/home/aistudio/output/three-center-result.json"));

const noToken=await probeBaiduAIStudio({});
assert.equal(noToken.configured,false);
assert.equal(noToken.authenticated,false);
assert.equal(noToken.manual_ready,false);
assert.equal(noToken.automation_ready,false);
assert.equal(noToken.dispatch_enabled,false);
assert.equal(noToken.secret_echo,false);

const originalFetch=globalThis.fetch;
try{
  let seenAuthorization="";
  globalThis.fetch=async(_url,init={})=>{
    seenAuthorization=String(init?.headers?.authorization||"");
    return new Response(JSON.stringify({data:[{id:"model-a"},{id:"model-b"}]}),{status:200,headers:{"content-type":"application/json"}});
  };
  const token="synthetic-test-token";
  const ok=await probeBaiduAIStudio({BAIDU_AISTUDIO_ACCESS_TOKEN:token});
  assert.equal(seenAuthorization,`Bearer ${token}`);
  assert.equal(ok.ok,true);
  assert.equal(ok.configured,true);
  assert.equal(ok.authenticated,true);
  assert.equal(ok.authentication_tested,true);
  assert.equal(ok.manual_ready,true);
  assert.equal(ok.automation_ready,false);
  assert.equal(ok.dispatch_enabled,false);
  assert.equal(ok.models_visible,2);
  assert.equal(ok.secret_echo,false);
  assert.equal(JSON.stringify(ok).includes(token),false);

  globalThis.fetch=async()=>new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
  const denied=await probeBaiduAIStudio({BAIDU_AISTUDIO_ACCESS_TOKEN:"synthetic-denied-token"});
  assert.equal(denied.ok,false);
  assert.equal(denied.authenticated,false);
  assert.equal(denied.manual_ready,false);
  assert.equal(denied.token_probe_http_status,401);
  assert.equal(denied.secret_echo,false);
  assert.equal(JSON.stringify(denied).includes("synthetic-denied-token"),false);
}finally{
  globalThis.fetch=originalFetch;
}

console.log(JSON.stringify({ok:true,suite:"predeploy",kaggle_result_parser:true,kaggle_meta:true,baidu_policy:true,baidu_token_probe_mock:true,baidu_negative_auth:true,baidu_bce_signature:true,baidu_fixed_bundle:true,network:false}));
