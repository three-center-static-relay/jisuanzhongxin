import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/v1/providers/huawei-functiongraph/credential-shape";
const response=await fetch(url,{headers:{"cache-control":"no-cache"}});
assert.equal(response.status,200,"credential-shape endpoint must return HTTP 200");
const body=await response.json();
const safe={
  ok:body?.ok===true,
  ak_present:body?.ak_present===true,
  sk_present:body?.sk_present===true,
  ak_length:Number(body?.ak_length||0),
  sk_length:Number(body?.sk_length||0),
  ak_alnum:body?.ak_alnum===true,
  sk_alnum:body?.sk_alnum===true,
  secret_echo:body?.secret_echo===true
};
console.log("HUAWEI_CREDENTIAL_SHAPE_SAFE",JSON.stringify(safe));
assert.equal(safe.ok,true);
assert.equal(safe.ak_present,true);
assert.equal(safe.sk_present,true);
assert.equal(safe.ak_length,20);
assert.equal(safe.sk_length,40);
assert.equal(safe.ak_alnum,true);
assert.equal(safe.sk_alnum,true);
assert.equal(safe.secret_echo,false);
console.log("PASS huawei-runtime-credential-shape-live");
