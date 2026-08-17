import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/providers/kaggle/health";
const response=await fetch(url,{method:"GET",headers:{accept:"application/json"}});
const body=await response.json().catch(()=>({}));
assert.equal(response.status,200);
assert.equal(body.ok,true);
assert.equal(body.authenticated,true);
assert.equal(body.current_live_health_verified,true);
assert.equal(body.route_eligible,true);
assert.equal(body.business_e2e,false);
assert.equal(body.business_e2e_current,false);
assert.equal(body.business_e2e_historically_verified,true);
console.log(JSON.stringify({ok:true,suite:"diag-kaggle-live-health-v3",read_only:true,no_execution:true,http_status:200,authenticated:true,current_live_health_verified:true,route_eligible:true,business_e2e_current:false,historical_e2e:true}));
