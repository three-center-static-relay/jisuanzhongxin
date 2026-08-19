import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {probeHuaweiDummyAuthTransport}=await import("../src/huawei-functiongraph-diagnostic.js");
const project="0123456789abcdef0123456789abcdef";
const realAkMarker="R".repeat(20),realSkMarker="T".repeat(40);
const env={HUAWEI_CLOUD_AK:realAkMarker,HUAWEI_CLOUD_SK:realSkMarker,HUAWEI_FUNCTION_URN:`urn:fss:cn-south-4:${project}:function:default:test1:latest`};
const oldFetch=globalThis.fetch;
try{
  let seenAuthorization="";
  globalThis.fetch=async(url,init)=>{
    assert.equal(String(url),"https://iam.myhuaweicloud.com/v3/projects?name=cn-south-4");
    seenAuthorization=String(init?.headers?.authorization||"");
    return new Response(JSON.stringify({error_code:"APIGW.0301",error_msg:"Get secretKey failed, ak not exist"}),{status:401,headers:{"content-type":"application/json"}});
  };
  const out=await probeHuaweiDummyAuthTransport(env);
  assert.equal(out.ok,true);
  assert.equal(out.used_real_credentials,false);
  assert.equal(out.authorization_header_recognized,true);
  assert.equal(out.auth_detail_class,"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED");
  assert.equal(out.secret_echo,false);
  assert.equal(seenAuthorization.includes(realAkMarker),false);
  assert.equal(seenAuthorization.includes(realSkMarker),false);
  const serialized=JSON.stringify(out);
  assert.equal(serialized.includes(realAkMarker),false);
  assert.equal(serialized.includes(realSkMarker),false);
}finally{globalThis.fetch=oldFetch}

console.log(JSON.stringify({ok:true,suite:"huawei-dummy-auth-transport-contract",real_credentials_used:false,authorization_transport_classified:true,secrets_redacted:true}));
