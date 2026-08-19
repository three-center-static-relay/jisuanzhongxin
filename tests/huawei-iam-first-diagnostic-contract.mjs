import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {probeHuaweiCredentialCrosscheck,probeHuaweiIamIdentity}=await import("../src/huawei-functiongraph-diagnostic.js");

const project="0123456789abcdef0123456789abcdef";
const otherProject="fedcba9876543210fedcba9876543210";
const region="cn-south-4";
const env={
  HUAWEI_CLOUD_AK:"A".repeat(20),
  HUAWEI_CLOUD_SK:"S".repeat(40),
  HUAWEI_FUNCTION_URN:`urn:fss:${region}:${project}:function:default:test1:latest`
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const oldFetch=globalThis.fetch;

try{
  let calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push({url:String(url),headers:init?.headers||{}});
    assert.match(String(url),/^https:\/\/iam\.myhuaweicloud\.com\/v3\/projects\?name=cn-south-4$/);
    assert.match(String(init.headers.authorization||""),/^SDK-HMAC-SHA256 Access=/);
    return json({projects:[{id:project,name:region,enabled:true}]});
  };
  const identity=await probeHuaweiIamIdentity(env);
  assert.equal(identity.ok,true);
  assert.equal(identity.authenticated,true);
  assert.equal(identity.authorized,true);
  assert.equal(identity.resolved_project_present,true);
  assert.equal(identity.project_context_match,true);
  assert.equal(identity.secret_echo,false);
  assert.equal(calls.length,1);

  calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    return json({projects:[{id:otherProject,name:region,enabled:true}]});
  };
  const mismatch=await probeHuaweiCredentialCrosscheck(env);
  assert.equal(mismatch.ok,false);
  assert.equal(mismatch.iam_authenticated,true);
  assert.equal(mismatch.project_context_match,false);
  assert.equal(mismatch.cts_attempted,false);
  assert.equal(mismatch.error_class,"HUAWEI_PROJECT_CONTEXT_MISMATCH");
  assert.equal(calls.length,1);

  calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(calls.length===1)return json({error_code:"APIGW.0301",error_msg:"authentication failed"},401);
    throw new Error("CTS must not run after IAM 401");
  };
  const rejected=await probeHuaweiCredentialCrosscheck(env);
  assert.equal(rejected.ok,false);
  assert.equal(rejected.stage,"iam-identity");
  assert.equal(rejected.iam_authenticated,false);
  assert.equal(rejected.cts_attempted,false);
  assert.equal(calls.length,1);

  calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(calls.length===1)return json({projects:[{id:project,name:region,enabled:true}]});
    assert.match(String(url),new RegExp(`^https://cts\\.${region}\\.myhuaweicloud\\.com/v3/${project}/trackers$`));
    return json({trackers:[]},200);
  };
  const crosscheck=await probeHuaweiCredentialCrosscheck(env);
  assert.equal(crosscheck.ok,true);
  assert.equal(crosscheck.authenticated,true);
  assert.equal(crosscheck.iam_authenticated,true);
  assert.equal(crosscheck.project_context_match,true);
  assert.equal(crosscheck.cts_attempted,true);
  assert.equal(crosscheck.secret_echo,false);
  assert.equal(calls.length,2);
}finally{
  globalThis.fetch=oldFetch;
}

console.log(JSON.stringify({ok:true,suite:"huawei-iam-first-diagnostic-contract",iam_first:true,project_context_isolated:true,cts_blocked_on_iam_failure:true,secrets_redacted:true}));
