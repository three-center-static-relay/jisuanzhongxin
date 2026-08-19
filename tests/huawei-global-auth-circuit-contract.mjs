import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {CenterGate}=await import("../src/guard.js");
const {maybeHandleHuaweiFunctionGraph}=await import("../src/huawei-functiongraph-router.js");

class MemoryStorage{
  constructor(){this.map=new Map()}
  async get(key){return this.map.get(key)}
  async put(key,value){this.map.set(key,value)}
  async delete(key){this.map.delete(key)}
}
const state={storage:new MemoryStorage()};
const gate=new CenterGate(state,{});
const call=async(path,method="POST",body={})=>{
  const init={method,headers:{"content-type":"application/json"}};
  if(method!=="GET")init.body=JSON.stringify(body);
  const response=await gate.fetch(new Request(`https://gate.internal${path}`,init));
  return{status:response.status,body:await response.json()};
};

const first=await call("/auth-circuit/huawei-functiongraph/acquire");
assert.equal(first.status,200);
assert.equal(first.body.ok,true);
assert.equal(first.body.upstream_allowed,true);
assert.equal(typeof first.body.attempt_id,"string");

const concurrent=await call("/auth-circuit/huawei-functiongraph/acquire");
assert.equal(concurrent.status,409);
assert.equal(concurrent.body.error,"AUTH_PROBE_INFLIGHT");
assert.equal(concurrent.body.upstream_allowed,false);

const wrongOwner=await call("/auth-circuit/huawei-functiongraph/result","POST",{attempt_id:"wrong",auth_failed:true});
assert.equal(wrongOwner.status,409);
assert.equal(wrongOwner.body.error,"AUTH_PROBE_OWNER_MISMATCH");

const failed=await call("/auth-circuit/huawei-functiongraph/result","POST",{attempt_id:first.body.attempt_id,auth_failed:true});
assert.equal(failed.status,200);
assert.equal(failed.body.cooldown_active,true);
assert.equal(failed.body.cooldown_remaining_ms,300000);

const stateDuringCooldown=await call("/auth-circuit/huawei-functiongraph/state","GET");
assert.equal(stateDuringCooldown.status,200);
assert.equal(stateDuringCooldown.body.cooldown_active,true);
assert.equal(stateDuringCooldown.body.upstream_allowed,false);
assert.ok(stateDuringCooldown.body.cooldown_remaining_ms>0);

const blocked=await call("/auth-circuit/huawei-functiongraph/acquire");
assert.equal(blocked.status,429);
assert.equal(blocked.body.error,"AUTH_COOLDOWN");
assert.equal(blocked.body.upstream_allowed,false);

let upstreamGateCalls=0;
const env={
  HUAWEI_CLOUD_AK:"A".repeat(20),
  HUAWEI_CLOUD_SK:"S".repeat(40),
  HUAWEI_FUNCTION_URN:"urn:fss:cn-south-4:0123456789abcdef0123456789abcdef:function:default:test1:latest",
  CENTER_GATE:{
    idFromName(){return"global"},
    get(){return{async fetch(){upstreamGateCalls++;return Response.json({ok:false,error:"AUTH_COOLDOWN",cooldown_active:true,cooldown_remaining_ms:240000,probe_inflight:false,upstream_allowed:false,secrets_redacted:true},{status:429})}}}
  }
};
const routed=await maybeHandleHuaweiFunctionGraph(new Request("https://compute.internal/v1/providers/huawei-functiongraph/auth-canary"),env);
assert.equal(routed.status,503);
const routedBody=await routed.json();
assert.equal(routedBody.error_class,"HUAWEI_AUTH_COOLDOWN_ACTIVE");
assert.equal(routedBody.cooldown_active,true);
assert.equal(routedBody.upstream_called,false);
assert.equal(routedBody.auth_circuit,"global-durable-object");
assert.equal(routedBody.route_eligible,false);
assert.equal(routedBody.paid_fallback,false);
assert.equal(routedBody.secret_echo,false);
assert.equal(upstreamGateCalls,1);

console.log(JSON.stringify({ok:true,suite:"huawei-global-auth-circuit-contract",global_single_probe:true,five_minute_cooldown:true,router_suppresses_upstream:true,fail_closed:true,secrets_redacted:true}));
