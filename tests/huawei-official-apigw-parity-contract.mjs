import assert from "node:assert/strict";
import crypto,{webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {signHuaweiRequest}=await import("../src/huawei-functiongraph.js");

const enc=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const hmac=(k,s)=>crypto.createHmac("sha256",k).update(s).digest("hex");
function currentCoreReferenceSign({method,url,headers={},data,ak,sk,date}){
  const u=new URL(url),x=date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const h={...headers,host:u.host,"x-sdk-date":x};
  const ordered=Object.entries(h).map(([k,v])=>[k.toLowerCase(),String(v)]).sort((a,b)=>a[0].localeCompare(b[0]));
  const names=ordered.map(([k])=>k).join(";");
  let uri=u.pathname.split("/").map(enc).join("/"); if(!uri.endsWith("/"))uri+="/";
  const keys=[...new Set(u.searchParams.keys())].sort(),q=[];
  for(const k of keys)for(const v of u.searchParams.getAll(k).sort())q.push(`${enc(k)}=${enc(v)}`);
  const payload=data?JSON.stringify(data):"";
  const canonical=[method.toUpperCase(),uri,q.join("&"),ordered.map(([k,v])=>`${k}:${v}\n`).join(""),names,sha(payload)].join("\n");
  const sig=hmac(sk,["SDK-HMAC-SHA256",x,sha(canonical)].join("\n"));
  return{authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${names}, Signature=${sig}`,x_sdk_date:x,signed_headers:names,payload};
}

const date=new Date("2026-08-20T03:00:00.000Z"),ak="AK_TEST_ONLY_12345678",sk="SK_TEST_ONLY_123456789012345678901234567";
const project="0123456789abcdef0123456789abcdef";
const listUrl=`https://functiongraph.cn-south-4.myhuaweicloud.com/v2/${project}/fgs/functions?maxitems=1`;
const listHeaders={"content-type":"application/json","x-project-id":project};

// Current huaweicloud-sdk-nodejs-v3 AKSKSigner hashes JSON.stringify(request.data)
// whenever request.data is truthy, including the generated ListFunctions GET data:{} shape.
const coreGetWithData=currentCoreReferenceSign({method:"GET",url:listUrl,headers:listHeaders,data:{},ak,sk,date});
const oursWithCorePayload=await signHuaweiRequest({method:"GET",url:listUrl,headers:listHeaders,body:coreGetWithData.payload,ak,sk,date});
assert.deepEqual(oursWithCorePayload,{authorization:coreGetWithData.authorization,x_sdk_date:coreGetWithData.x_sdk_date,signed_headers:coreGetWithData.signed_headers});

// Also lock the empty-payload GET shape used by the lightweight Worker fetch path.
const emptyGet=currentCoreReferenceSign({method:"GET",url:listUrl,headers:listHeaders,data:undefined,ak,sk,date});
const oursEmpty=await signHuaweiRequest({method:"GET",url:listUrl,headers:listHeaders,body:"",ak,sk,date});
assert.deepEqual(oursEmpty,{authorization:emptyGet.authorization,x_sdk_date:emptyGet.x_sdk_date,signed_headers:emptyGet.signed_headers});

const iamUrl="https://iam.myhuaweicloud.com/v3/projects?name=cn-south-4";
const iamHeaders={"content-type":"application/json"};
const iamExpected=currentCoreReferenceSign({method:"GET",url:iamUrl,headers:iamHeaders,data:undefined,ak,sk,date});
const iamActual=await signHuaweiRequest({method:"GET",url:iamUrl,headers:iamHeaders,body:"",ak,sk,date});
assert.deepEqual(iamActual,{authorization:iamExpected.authorization,x_sdk_date:iamExpected.x_sdk_date,signed_headers:iamExpected.signed_headers});

console.log(JSON.stringify({ok:true,suite:"huawei-official-apigw-parity-contract",reference:"huaweicloud-sdk-nodejs-v3-current-AKSKSigner",functiongraph_get_data_object:true,functiongraph_get_empty_payload:true,iam_get_empty_payload:true,network:false,real_credentials:false}));
