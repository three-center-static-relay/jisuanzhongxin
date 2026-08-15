import assert from "node:assert/strict";
import {extractKaggleResult,officialMeta as kaggleOfficialMeta} from "../src/kaggle-official.js";
import {baiduAIStudioMeta,probeBaiduAIStudio} from "../src/baidu-aistudio.js";
import {probeWolfram,queryWolfram,wolframMeta} from "../src/wolfram.js";

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
assert.equal(meta.unattended_ready,false);

const noToken=await probeBaiduAIStudio({});
assert.equal(noToken.configured,false);
assert.equal(noToken.authenticated,false);
assert.equal(noToken.manual_ready,false);
assert.equal(noToken.automation_ready,false);
assert.equal(noToken.dispatch_enabled,false);
assert.equal(noToken.secret_echo,false);

const wm=wolframMeta();
assert.equal(wm.provider,"wolfram-alpha");
assert.equal(wm.integration,"official-full-results-api-v2");
assert.equal(wm.secret_name,"WOLFRAM_APP_ID");
assert.equal(wm.arbitrary_url,false);
assert.equal(wm.arbitrary_code,false);
assert.equal(wm.route_eligible,true);
const noAppId=await probeWolfram({});
assert.equal(noAppId.configured,false);
assert.equal(noAppId.authenticated,false);
assert.equal(noAppId.secret_echo,false);

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

  let wolframUrl="";
  globalThis.fetch=async(url)=>{
    wolframUrl=String(url);
    return new Response(JSON.stringify({queryresult:{success:true,error:false,numpods:2,datatypes:"Math",timing:0.01,pods:[{title:"Input interpretation",id:"Input",scanner:"Identity",subpods:[{plaintext:"2+2"}]},{title:"Result",id:"Result",scanner:"Numeric",primary:true,subpods:[{plaintext:"4"}]}]}}),{status:200,headers:{"content-type":"application/json"}});
  };
  const syntheticAppId="SYNTHETIC-APPID";
  const wq=await queryWolfram({WOLFRAM_APP_ID:syntheticAppId},"2+2");
  assert.equal(wq.result.success,true);
  assert.equal(wq.result.pods.find(x=>x.id==="Result")?.subpods?.[0]?.plaintext,"4");
  const wu=new URL(wolframUrl);
  assert.equal(`${wu.origin}${wu.pathname}`,"https://api.wolframalpha.com/v2/query");
  assert.equal(wu.searchParams.get("appid"),syntheticAppId);
  assert.equal(wu.searchParams.get("input"),"2+2");
  assert.equal(wu.searchParams.get("output"),"json");
  assert.equal(wu.searchParams.get("format"),"plaintext");
  assert.equal(JSON.stringify(wq).includes(syntheticAppId),false);
  const wp=await probeWolfram({WOLFRAM_APP_ID:syntheticAppId});
  assert.equal(wp.ok,true);
  assert.equal(wp.authenticated,true);
  assert.equal(wp.computation_ok,true);
  assert.equal(wp.secret_echo,false);
  assert.equal(JSON.stringify(wp).includes(syntheticAppId),false);
  await assert.rejects(()=>queryWolfram({WOLFRAM_APP_ID:syntheticAppId},"x".repeat(2001)),/WOLFRAM_INPUT_TOO_LONG/);
}finally{
  globalThis.fetch=originalFetch;
}

console.log(JSON.stringify({ok:true,suite:"predeploy",kaggle_result_parser:true,kaggle_meta:true,baidu_policy:true,baidu_token_probe_mock:true,baidu_negative_auth:true,wolfram_contract:true,wolfram_secret_redaction:true,wolfram_fixed_endpoint:true,unsupported_baidu_native_http_removed:true,network:false}));
