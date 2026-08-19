import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const {probeHuaweiCredentialCrosscheck}=await import("../src/huawei-functiongraph-diagnostic.js");

const project="0123456789abcdef0123456789abcdef";
const region="cn-south-4";
const env={HUAWEI_CLOUD_AK:"A".repeat(20),HUAWEI_CLOUD_SK:"S".repeat(40),HUAWEI_FUNCTION_URN:`urn:fss:${region}:${project}:function:default:test1:latest`};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const oldFetch=globalThis.fetch;

try{
  let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;
    if(calls===1){
      assert.equal(String(url),`https://iam.myhuaweicloud.com/v3/projects?name=${region}`);
      assert.equal(Object.prototype.hasOwnProperty.call(init.headers,"x-project-id"),false);
      return json({projects:[{id:project,name:region,enabled:true}]});
    }
    assert.equal(String(url),`https://cts.${region}.myhuaweicloud.com/v3/${project}/trackers`);
    assert.equal(init.headers["x-project-id"],project);
    assert.match(String(init.headers.authorization||""),/SignedHeaders=.*x-project-id/);
    return json({trackers:[]});
  };
  const ok=await probeHuaweiCredentialCrosscheck(env);
  assert.equal(ok.iam_authenticated,true);
  assert.equal(ok.project_context_match,true);
  assert.equal(ok.authenticated,true);
  assert.equal(ok.authorized,true);
  assert.equal(calls,2);

  calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return json({error_code:"APIGW.0301",error_msg:"authentication failed"},401);
  };
  const rejected=await probeHuaweiCredentialCrosscheck(env);
  assert.equal(rejected.iam_authenticated,false);
  assert.equal(rejected.authenticated,false);
  assert.equal(rejected.service,"iam");
  assert.equal(calls,1);
}finally{
  globalThis.fetch=oldFetch;
}

console.log(JSON.stringify({ok:true,suite:"huawei-cts-project-header-contract",iam_first:true,cts_x_project_id_signed:true,cts_blocked_after_iam_401:true,secrets_redacted:true}));
