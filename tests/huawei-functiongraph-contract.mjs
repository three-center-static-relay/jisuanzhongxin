import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {mutateHuaweiAkForControl}=await import("../src/huawei-functiongraph-diagnostic.js");
const {classifyHuaweiError,huaweiFunctionGraphMeta,huaweiSignerSelftest,parseHuaweiFunctionUrn,signHuaweiRequest}=await import("../src/huawei-functiongraph.js");
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
const signerSelftest=await huaweiSignerSelftest();
assert.equal(signerSelftest.ok,true);
assert.equal(signerSelftest.expected_signature_match,true);
assert.equal(signerSelftest.secret_echo,false);

assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: verify aksk signature fail"),"HUAWEI_AKSK_SIGNATURE_FAILED");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: Get secretKey failed,ak:REDACTED,err:ak not exist"),"HUAWEI_AK_NOT_FOUND");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: AK access failed to reach the limit, forbidden"),"HUAWEI_AK_TEMP_LOCKED_OR_RESTRICTED");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: x-auth-token not found"),"HUAWEI_X_AUTH_TOKEN_MISSING");
assert.equal(classifyHuaweiError("APIGW.0301","Incorrect IAM authentication information: token expires"),"HUAWEI_TOKEN_EXPIRED");
assert.equal(classifyHuaweiError("APIGW.0302","not authorized"),"HUAWEI_IAM_NOT_AUTHORIZED");
assert.equal(classifyHuaweiError("APIGW.0301","unknown auth detail"),"HUAWEI_IAM_AUTH_FAILED");

assert.equal(mutateHuaweiAkForControl("A".repeat(20)),`B${"A".repeat(19)}`);
assert.equal(mutateHuaweiAkForControl("Z".repeat(20)),`A${"Z".repeat(19)}`);
assert.equal(mutateHuaweiAkForControl("").length,0);

const metaResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/meta"),{});
assert.equal(metaResponse.status,200);
const metaBody=await metaResponse.json();
assert.equal(metaBody.provider,"huawei-functiongraph");
assert.equal(metaBody.configured,false);
assert.equal(metaBody.secret_echo,false);

const shapeEnv={HUAWEI_CLOUD_AK:"A".repeat(20),HUAWEI_CLOUD_SK:"S".repeat(40)};
const shapeResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/credential-shape"),shapeEnv);
assert.equal(shapeResponse.status,200);
const shape=await shapeResponse.json();
assert.equal(shape.ok,true);
assert.equal(shape.ak_length,20);
assert.equal(shape.sk_length,40);
assert.equal(shape.ak_alnum,true);
assert.equal(shape.sk_alnum,true);
assert.equal(shape.secret_echo,false);
const shapeSerialized=JSON.stringify(shape);
assert.equal(shapeSerialized.includes("A".repeat(20)),false);
assert.equal(shapeSerialized.includes("S".repeat(40)),false);

const signerResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/signer-selftest"),{});
assert.equal(signerResponse.status,200);
const signerBody=await signerResponse.json();
assert.equal(signerBody.ok,true);
assert.equal(signerBody.expected_signature_match,true);
assert.equal(signerBody.secret_echo,false);

const canaryResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/auth-canary"),{});
assert.equal(canaryResponse.status,503);
const canaryBody=await canaryResponse.json();
assert.equal(canaryBody.canary,"list-functions-auth");
assert.equal(canaryBody.authenticated,false);
assert.equal(canaryBody.secret_echo,false);

const controlResponse=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/ak-control"),{});
assert.equal(controlResponse.status,503);
const controlBody=await controlResponse.json();
assert.equal(controlBody.canary,"mutated-ak-control");
assert.equal(controlBody.control_ak_mutated,false);
assert.equal(controlBody.control_ak_not_found,false);
assert.equal(controlBody.secret_echo,false);

const fresh1=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/health?fresh=1"),{});
assert.equal(fresh1.status,503);
const freshBody1=await fresh1.json();
assert.equal(freshBody1.cached_health,false);
assert.equal(freshBody1.fresh_probe_requested,true);
assert.equal(freshBody1.refresh_suppressed,false);

const fresh2=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/health?fresh=1"),{});
assert.equal(fresh2.status,503);
const freshBody2=await fresh2.json();
assert.equal(freshBody2.cached_health,true);
assert.equal(freshBody2.fresh_probe_requested,true);
assert.equal(freshBody2.refresh_suppressed,true);

const denied=await maybeHandleHuaweiFunctionGraph(new Request("https://example.test/v1/providers/huawei-functiongraph/compute",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}),{});
assert.equal(denied.status,403);
const deniedBody=await denied.json();
assert.equal(deniedBody.error,"POLICY_DENIED");
assert.equal(deniedBody.secret_echo,false);

console.log("PASS huawei-functiongraph-contract");
