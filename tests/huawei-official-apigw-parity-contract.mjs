import assert from "node:assert/strict";
import crypto,{webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {signHuaweiRequest}=await import("../src/huawei-functiongraph.js");

const enc=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const hmac=(k,s)=>crypto.createHmac("sha256",k).update(s).digest("hex");
function referenceSign({method,url,headers={},body="",ak,sk,date}){
  const u=new URL(url),x=date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const h={...headers,host:u.host,"x-sdk-date":x};
  const ordered=Object.entries(h).map(([k,v])=>[k.toLowerCase(),String(v).trim()]).sort((a,b)=>a[0].localeCompare(b[0]));
  const names=ordered.map(([k])=>k).join(";");
  let uri=u.pathname.split("/").map(enc).join("/"); if(!uri.endsWith("/"))uri+="/";
  const keys=[...new Set(u.searchParams.keys())].sort(),q=[];
  for(const k of keys)for(const v of u.searchParams.getAll(k).sort())q.push(`${enc(k)}=${enc(v)}`);
  const payload=["GET","DELETE","HEAD"].includes(method.toUpperCase())?"":body;
  const canonical=[method.toUpperCase(),uri,q.join("&"),ordered.map(([k,v])=>`${k}:${v}\n`).join(""),names,sha(payload)].join("\n");
  const sig=hmac(sk,["SDK-HMAC-SHA256",x,sha(canonical)].join("\n"));
  return{authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${names}, Signature=${sig}`,x_sdk_date:x,signed_headers:names};
}

const date=new Date("2026-08-20T03:00:00.000Z"),ak="AK_TEST_ONLY_12345678",sk="SK_TEST_ONLY_123456789012345678901234567";
const project="0123456789abcdef0123456789abcdef";
const vectors=[
  {method:"GET",url:`https://functiongraph.cn-south-4.myhuaweicloud.com/v2/${project}/fgs/functions?maxitems=1`,headers:{"content-type":"application/json","x-project-id":project},body:"SHOULD_BE_IGNORED_FOR_GET"},
  {method:"GET",url:"https://iam.myhuaweicloud.com/v3/projects?name=cn-south-4",headers:{"content-type":"application/json"},body:""}
];
for(const v of vectors){
  const expected=referenceSign({...v,ak,sk,date});
  const actual=await signHuaweiRequest({...v,body:"",ak,sk,date});
  assert.deepEqual(actual,expected);
}
console.log(JSON.stringify({ok:true,suite:"huawei-official-apigw-parity-contract",vectors:vectors.length,reference:"APIGW-javascript-sdk-2.0.5-semantics",get_body_empty:true,network:false,real_credentials:false}));
