import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {classifyHuaweiError,huaweiFunctionGraphMeta,parseHuaweiFunctionUrn,signHuaweiRequest}=await import("../src/huawei-functiongraph.js");
const {maybeHandleHuaweiFunctionGraph}=await import("../src/huawei-functiongraph-router.js");

const project="0123456789abcdef0123456789abcdef";
const urn=`urn:fss:cn-south-4:${project}:function:default:test1`;
const parsed=parseHuaweiFunctionUrn(urn);
assert.equal(parsed.ok,true);
assert.equal(parsed.region,"cn-south-4");
assert.equal(parsed.project_id,project);
assert.equal(parsed.function_name,"test1");
assert.equal(parseHuaweiFunctionUrn("bad-urn").ok,false);

const meta=huaweiFunctionGraphMeta({HUAWEI_CLOUD_AK:"ak",HUAWEI_CLOUD_SK:"sk",HUAWEI_FUNCTION_URN:urn});
assert.equal(meta.configured,true);
assert.equal(meta.trigger_required,false);
assert.equal(meta.apig_required,false);
assert.equal(meta.auth,"ak-sk-signed");
assert.equal(meta.route_eligible,false);
assert.equal(meta.paid_fallback,false);
assert.equal(meta.secret_echo,false);

const signed=await signHuaweiRequest({
  method:"POST",
  url:`https://functiongraph.cn-south-4.myhuaweicloud.com/v2/${project}/fgs/functions/${urn}/invocations`,
  headers:{"content-type":"application/json","x-cff-request-version":"v1","x-project-id":project},
  body:'{"selftest":"ok"}',
  ak:"AK_TEST",
  sk:"SK_TEST",
  date:new Date("2026-08-19T09:00:00.000Z")
});
assert.equal(signed.x_sdk_date,"20260819T090000Z");
assert.equal(signed.signed_headers,"content-type;host;x-cff-request-version;x-project-id;x-sdk-date");
assert.match(signed.authorization,/^SDK-HMAC-SHA256 Access=AK_TEST, SignedHeaders=content-type;host;x-cff-request-version;x-project-id;x-sdk-date, Signature=[0-9a-f]{64}$/);
assert.equal(signed.authorization.includes("SK_TEST"),false);

assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: verify aksk signature fail"),"HUAWEI_AKSK_SIGNATURE_FAILED");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: Get secretKey failed,ak:REDACTED,err:ak not exist"),"HUAWEI_AK_NOT_FOUND");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: AK access failed to reach the limit, forbidden"),"HUAWEI_AK_TEMP_LOCKED_OR_RESTRICTED");
assert.equal(classifyHuaweiError("APIGW.0301","unknown auth detail"),"HUAWEI_IAM_AUTH_FAILED");

const metaResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/meta"),{});
assert.equal(metaResponse.status,200);
const metaBody=await metaResponse.json();
assert.equal(metaBody.provider,"huawei-functiongraph");
assert.equal(metaBody.configured,false);
assert.equal(metaBody.secret_echo,false);

const denied=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/compute",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}),{});
assert.equal(denied.status,403);
const deniedBody=await denied.json();
assert.equal(deniedBody.error,"POLICY_DENIED");
assert.equal(deniedBody.secret_echo,false);

console.log("PASS huawei-functiongraph-contract");
