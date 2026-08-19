import assert from "node:assert/strict";

const BASE="https://compute-worker.a15280020511.workers.dev";

async function getJson(path){
  const response=await fetch(`${BASE}${path}`,{
    headers:{"accept":"application/json","cache-control":"no-cache"},
    signal:AbortSignal.timeout(30000)
  });
  const text=await response.text();
  let body;
  try{body=JSON.parse(text)}catch{throw new Error(`${path} returned non-JSON: ${text.slice(0,200)}`)}
  return {response,body};
}

const meta=await getJson("/v1/providers/huawei-functiongraph/meta");
assert.equal(meta.response.status,200,"meta HTTP must be 200");
assert.equal(meta.body.ok,true,"meta ok");
assert.equal(meta.body.provider,"huawei-functiongraph");
assert.equal(meta.body.configured,true,"Huawei AK/SK/URN must all be configured");
assert.equal(meta.body.region,"cn-south-4");
assert.equal(meta.body.function_name,"test1");
assert.equal(meta.body.project_id_present,true);
assert.equal(meta.body.trigger_required,false);
assert.equal(meta.body.apig_required,false);
assert.equal(meta.body.paid_fallback,false);
assert.equal(meta.body.route_eligible,false,"must remain fail-closed until quota guard");
assert.equal(meta.body.secret_echo,false);

const health=await getJson("/v1/providers/huawei-functiongraph/health");
assert.equal(health.response.status,200,"health HTTP must be 200");
assert.equal(health.body.ok,true,"live FunctionGraph invocation must pass");
assert.equal(health.body.configured,true);
assert.equal(health.body.provider,"huawei-functiongraph");
assert.equal(health.body.selftest,"huawei-functiongraph");
assert.equal(health.body.echo_verified,true,"test1 must echo the canary payload");
assert.equal(health.body.acceptance_state,"live-echo-e2e-verified");
assert.equal(health.body.http_status,200,"Huawei API HTTP must be 200");
assert.equal(health.body.invoke_status,200,"FunctionGraph invoke status must be 200");
assert.equal(health.body.region,"cn-south-4");
assert.equal(health.body.function_name,"test1");
assert.equal(health.body.paid_fallback,false);
assert.equal(health.body.route_eligible,false,"must remain fail-closed until quota guard");
assert.equal(health.body.secret_echo,false);
assert.ok(typeof health.body.request_id==="string"&&health.body.request_id.length>0,"Huawei request_id required");

console.log(JSON.stringify({
  ok:true,
  acceptance:"HUAWEI_FUNCTIONGRAPH_LIVE_E2E_PASS",
  meta_http:meta.response.status,
  health_http:health.response.status,
  provider:health.body.provider,
  region:health.body.region,
  function_name:health.body.function_name,
  echo_verified:health.body.echo_verified,
  acceptance_state:health.body.acceptance_state,
  invoke_status:health.body.invoke_status,
  request_id_present:true,
  paid_fallback:health.body.paid_fallback,
  route_eligible:health.body.route_eligible,
  secrets_redacted:true
}));