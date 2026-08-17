import assert from "node:assert/strict";
import {modelscopeMeta,planModelScopeRoute,probeModelScope} from "../src/modelscope-compute.js";

const meta=modelscopeMeta();
assert.equal(meta.provider,"modelscope");
assert.equal(meta.free_only,true);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.automatic_paid_upgrade,false);
assert.equal(meta.daily_manual_claim_required,false);
assert.equal(meta.initial_manual_activation_may_be_required,true);
assert.equal(meta.route_eligible,false);

const missing=await probeModelScope({});
assert.equal(missing.ok,false);
assert.equal(missing.configured,false);
assert.equal(missing.route_eligible,false);
assert.equal(missing.acceptance_state,"token-required");

const oldFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async(url,init={})=>{
  calls.push({url:String(url),method:init.method||"GET",auth:init.headers?.authorization||""});
  if(String(url).endsWith("/users/me"))return new Response(JSON.stringify({username:"tester"}),{status:200,headers:{"content-type":"application/json"}});
  if(String(url).endsWith("/studios/hardware"))return new Response(JSON.stringify({items:[{id:"cpu-free",name:"CPU Free",is_free:true},{id:"gpu-paid",name:"GPU",price:1}]}),{status:200,headers:{"content-type":"application/json"}});
  return new Response("not found",{status:404});
};
try{
  const live=await probeModelScope({MODELSCOPE_API_TOKEN:"redacted-test-token"});
  assert.equal(live.ok,true);
  assert.equal(live.authenticated,true);
  assert.equal(live.hardware_discovery_ok,true);
  assert.equal(live.free_hardware_verified,true);
  assert.equal(live.route_eligible,false);
  assert.equal(live.current_runtime_e2e_verified,false);
  assert.equal(live.secret_echo,false);
  assert.ok(calls.every(x=>x.method==="GET"));
  assert.ok(calls.every(x=>x.auth==="Bearer redacted-test-token"));
  assert.equal(JSON.stringify(live).includes("redacted-test-token"),false);
}finally{globalThis.fetch=oldFetch}

const plan=planModelScopeRoute({gpu:true});
assert.equal(plan.provider,"modelscope");
assert.equal(plan.requested_accelerator,"gpu");
assert.equal(plan.free_only,true);
assert.equal(plan.execution_started,false);
assert.equal(plan.route_eligible,false);

console.log(JSON.stringify({ok:true,suite:"modelscope-provider",free_only:true,no_paid_fallback:true,no_daily_manual_claim:true,runtime_e2e_required:true}));
