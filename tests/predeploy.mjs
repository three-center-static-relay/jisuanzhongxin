import assert from "node:assert/strict";
import {extractKaggleResult} from "../src/kaggle-official.js";
import {baiduAIStudioMeta,probeBaiduAIStudio} from "../src/baidu-aistudio.js";

const expected={ok:true,task_id:"cpu-001",profile:"core",accelerator:"cpu"};
const encoded=JSON.stringify(expected);

assert.deepEqual(extractKaggleResult(`THREE_CENTER_RESULT:${encoded}`),expected);
assert.deepEqual(extractKaggleResult(`[2026-08-15T00:00:00Z] stdout THREE_CENTER_RESULT:${encoded}\nfinished`),expected);
assert.deepEqual(extractKaggleResult(`THREE_CENTER_RESULT:${encoded}\nTHREE_CENTER_RESULT:{bad-json}`),expected);
assert.equal(extractKaggleResult("ordinary log without result marker"),null);

const meta=baiduAIStudioMeta();
assert.equal(meta.payment_mode,"coupon");
assert.equal(meta.acoin_allowed,false);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.daily_maintenance_required,false);
assert.equal(meta.daily_checkin_required,false);
assert.equal(meta.bonus_harvesting,false);

const noToken=await probeBaiduAIStudio({});
assert.equal(noToken.configured,false);
assert.equal(noToken.authenticated,false);
assert.equal(noToken.secret_echo,false);

const originalFetch=globalThis.fetch;
let seenAuthorization="";
globalThis.fetch=async(_url,init={})=>{
  seenAuthorization=String(init?.headers?.authorization||"");
  return new Response(JSON.stringify({data:[{id:"model-a"},{id:"model-b"}]}),{status:200,headers:{"content-type":"application/json"}});
};
try{
  const token="synthetic-test-token";
  const ok=await probeBaiduAIStudio({BAIDU_AISTUDIO_ACCESS_TOKEN:token});
  assert.equal(seenAuthorization,`Bearer ${token}`);
  assert.equal(ok.ok,true);
  assert.equal(ok.configured,true);
  assert.equal(ok.authenticated,true);
  assert.equal(ok.authentication_tested,true);
  assert.equal(ok.manual_ready,true);
  assert.equal(ok.models_visible,2);
  assert.equal(ok.secret_echo,false);
  assert.equal(JSON.stringify(ok).includes(token),false);
}finally{
  globalThis.fetch=originalFetch;
}

console.log(JSON.stringify({ok:true,suite:"predeploy",kaggle_result_parser:true,baidu_policy:true,baidu_token_probe_mock:true,network:false}));
