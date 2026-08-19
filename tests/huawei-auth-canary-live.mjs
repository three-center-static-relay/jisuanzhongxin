import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/v1/providers/huawei-functiongraph/auth-canary";
const response=await fetch(url,{headers:{"cache-control":"no-cache"}});
const body=await response.json();
const safe={http_status:Number(body?.http_status||0),authenticated:body?.authenticated===true,authorized:body?.authorized===true,upstream_error_code:String(body?.upstream_error_code||""),error_class:String(body?.error_class||""),secret_echo:body?.secret_echo===true};
console.log("HUAWEI_AUTH_CANARY_SAFE",JSON.stringify(safe));
assert.equal(safe.secret_echo,false);
assert.equal(safe.authenticated,true,"common-aksk-auth-failed");
console.log("PASS huawei-auth-canary-live");
