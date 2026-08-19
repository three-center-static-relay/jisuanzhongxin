import {createHash,createHmac} from "node:crypto";
import {parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

const EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function encode(value){return encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}
function canonicalUri(pathname){const out=String(pathname||"/").split("/").map(encode).join("/");return out.endsWith("/")?out:`${out}/`}
function canonicalQuery(target){
  const keys=[...new Set(target.searchParams.keys())].sort();
  const out=[];
  for(const key of keys){const values=target.searchParams.getAll(key).sort();for(const value of values)out.push(`${encode(key)}=${encode(value)}`)}
  return out.join("&");
}
function sdkDate(date){return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
function officialPortSign({method,url,headers,ak,sk,date}){
  const target=new URL(url);
  const stamp=sdkDate(date);
  const allHeaders={...headers,"X-Sdk-Date":stamp,host:target.host};
  const ordered=Object.entries(allHeaders).sort((a,b)=>a[0].toLocaleLowerCase().localeCompare(b[0].toLocaleLowerCase()));
  const signedHeaders=ordered.map(([key])=>key).join(";").toLocaleLowerCase();
  const canonicalHeaders=ordered.map(([key,value])=>`${key.toLocaleLowerCase()}:${String(value)}\n`).join("");
  const canonicalRequest=[String(method).toUpperCase(),canonicalUri(target.pathname),canonicalQuery(target),canonicalHeaders,signedHeaders,EMPTY_SHA256].join("\n");
  const requestHash=createHash("sha256").update(canonicalRequest).digest("hex");
  const stringToSign=["SDK-HMAC-SHA256",stamp,requestHash].join("\n");
  const signature=createHmac("sha256",sk).update(stringToSign).digest("hex");
  return{authorization:`SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`,x_sdk_date:stamp,signed_headers:signedHeaders};
}

export async function probeHuaweiOfficialSignerParity(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-signer-parity",current_matches_official:null,x_sdk_date_parity:null,signed_headers_parity:null,credential_material_exposed:false,secret_echo:false};
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions?maxitems=1`;
  const headers={"content-type":"application/json","x-project-id":parsed.project_id};
  const date=new Date();
  const current=await signHuaweiRequest({method:"GET",url,headers,body:"",ak,sk,date});
  const official=officialPortSign({method:"GET",url,headers,ak,sk,date});
  return{ok:true,configured:true,provider:"huawei-signer-parity",current_matches_official:current.authorization===official.authorization,x_sdk_date_parity:current.x_sdk_date===official.x_sdk_date,signed_headers_parity:current.signed_headers===official.signed_headers,canonical_scope:"list-functions-get",official_reference:"AKSKSigner.ts-semantics",crypto_engines:"webcrypto-vs-node-crypto",upstream_called:false,credential_material_exposed:false,route_eligible:false,paid_fallback:false,secret_echo:false};
}
