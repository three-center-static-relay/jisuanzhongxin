import assert from "node:assert/strict";

const BASE="https://compute-worker.a15280020511.workers.dev";
const response=await fetch(`${BASE}/v1/providers/huawei-functiongraph/meta`,{
  headers:{"accept":"application/json","cache-control":"no-cache"},
  signal:AbortSignal.timeout(30000)
});
const text=await response.text();
let body;
try{body=JSON.parse(text)}catch{throw new Error(`meta returned non-JSON: ${text.slice(0,200)}`)}
assert.equal(response.status,200,"meta HTTP must be 200");
assert.equal(body.ok,true,"meta ok");
assert.equal(body.provider,"huawei-functiongraph");
assert.equal(body.configured,true,"Huawei AK/SK/URN must all be configured");
assert.equal(body.region,"cn-south-4");
assert.equal(body.function_name,"test1");
assert.equal(body.project_id_present,true);
assert.equal(body.trigger_required,false);
assert.equal(body.apig_required,false);
assert.equal(body.paid_fallback,false);
assert.equal(body.route_eligible,false);
assert.equal(body.secret_echo,false);
console.log(JSON.stringify({ok:true,acceptance:"HUAWEI_FUNCTIONGRAPH_META_PASS",http_status:response.status,configured:body.configured,provider:body.provider,region:body.region,function_name:body.function_name,secrets_redacted:true}));