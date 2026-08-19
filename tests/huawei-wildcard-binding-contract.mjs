import assert from "node:assert/strict";
import {resolveHuaweiCredentialBindings} from "../src/huawei-env.js";
import {maybeHandleHuaweiFunctionGraph} from "../src/huawei-functiongraph-router.js";

const ak="A".repeat(20);
const sk="S".repeat(40);

const wildcard=resolveHuaweiCredentialBindings({HUAWEI_CLOUD_AI:ak,HUAWEI_CLOUD_SI:sk});
assert.equal(wildcard.ak,ak);
assert.equal(wildcard.sk,sk);
assert.equal(wildcard.ak_mode,"wildcard");
assert.equal(wildcard.sk_mode,"wildcard");
assert.equal(wildcard.ambiguous,false);

const shapeResponse=await maybeHandleHuaweiFunctionGraph(
  new Request("https://example.test/v1/providers/huawei-functiongraph/credential-shape"),
  {HUAWEI_CLOUD_AI:ak,HUAWEI_CLOUD_SI:sk}
);
assert.equal(shapeResponse.status,200);
const shape=await shapeResponse.json();
assert.equal(shape.ok,true);
assert.equal(shape.ak_present,true);
assert.equal(shape.sk_present,true);
assert.equal(shape.ak_length,20);
assert.equal(shape.sk_length,40);
assert.equal(shape.secret_echo,false);
assert.equal(JSON.stringify(shape).includes(ak),false);
assert.equal(JSON.stringify(shape).includes(sk),false);

const canonical=resolveHuaweiCredentialBindings({HUAWEI_CLOUD_AK:"K".repeat(20),HUAWEI_CLOUD_AI:ak,HUAWEI_CLOUD_SK:sk});
assert.equal(canonical.ak,"K".repeat(20));
assert.equal(canonical.ak_mode,"canonical");
assert.equal(canonical.sk_mode,"canonical");

const ambiguous=resolveHuaweiCredentialBindings({HUAWEI_CLOUD_AI:ak,HUAWEI_CLOUD_AX:"B".repeat(20),HUAWEI_CLOUD_SI:sk});
assert.equal(ambiguous.ak,"");
assert.equal(ambiguous.ambiguous,true);

console.log("PASS huawei-wildcard-binding-contract");
