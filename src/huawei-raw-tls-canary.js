import {connect as tlsConnect} from "node:tls";
import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

function parseJson(value){try{return JSON.parse(String(value||"{}"))}catch{return{}}}
function dechunk(value){
  const s=String(value||""); let p=0,out="";
  try{
    while(p<s.length){const e=s.indexOf("\r\n",p);if(e<0)return s;const size=parseInt(s.slice(p,e).split(";",1)[0],16);if(!Number.isFinite(size))return s;p=e+2;if(size===0)return out;p+=size+2;out+=s.slice(p-size-2,p-2)}
    return out||s;
  }catch{return s}
}
function upstreamCode(body){return String(body?.error_code||body?.code||"").slice(0,80)||null}
function upstreamMessage(body){return body?.error_msg||body?.error_message||body?.errorMessage||body?.message||body?.error?.message||""}
function detailClass(message){
  const msg=String(message||"").toLowerCase();
  if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";
  if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";
  if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";
  if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";
  if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";
  return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL";
}

function rawTlsHttp11(target,headers){
  return new Promise((resolve,reject)=>{
    let settled=false,text="";
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};
    const socket=tlsConnect({host:target.hostname,port:443,servername:target.hostname,rejectUnauthorized:true},()=>{
      const lines=[`GET ${target.pathname}${target.search} HTTP/1.1`,`Host: ${target.host}`,`content-type: ${headers["content-type"]}`,`x-project-id: ${headers["x-project-id"]}`,`x-sdk-date: ${headers["x-sdk-date"]}`,`Authorization: ${headers.authorization}`,"Connection: close","",""];
      socket.write(lines.join("\r\n"));
    });
    const timer=setTimeout(()=>{try{socket.destroy()}catch{}finish(reject,new Error("TLS_TIMEOUT"))},15000);
    socket.on("data",chunk=>{text+=chunk.toString("utf8");if(text.length>131072){try{socket.destroy()}catch{}finish(resolve,{text,authorized:socket.authorized===true,truncated:true})}});
    socket.on("end",()=>finish(resolve,{text,authorized:socket.authorized===true,truncated:false}));
    socket.on("close",()=>{if(!settled&&text)finish(resolve,{text,authorized:socket.authorized===true,truncated:false})});
    socket.on("error",error=>finish(reject,error));
  });
}

export async function probeHuaweiRawTls(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-functiongraph-raw-tls",transport:"node:tls-manual-http1",wire_shape:"official-listfunctions-empty-get",body_bytes:0,http_status:0,tls_authorized:null,authenticated:false,authorized:false,auth_detail_class:"PREFLIGHT_FAILED",upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions?maxitems=1`,target=new URL(url);
  const baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:"",ak,sk});
    const raw=await rawTlsHttp11(target,{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization});
    const status=Number((/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i.exec(raw.text)||[])[1]||0);
    const sep=raw.text.indexOf("\r\n\r\n"),rawBody=sep>=0?raw.text.slice(sep+4):"",body=parseJson(dechunk(rawBody));
    const code=upstreamCode(body),message=upstreamMessage(body),rejected=status===401||code==="APIGW.0301"||code==="APIG.0301";
    return{ok:!rejected&&status>=200&&status<300,configured:true,provider:"huawei-functiongraph-raw-tls",transport:"node:tls-manual-http1",wire_shape:"official-listfunctions-empty-get",body_bytes:0,http_status:status,tls_authorized:raw.authorized,authenticated:!rejected&&status>0,authorized:status>=200&&status<300,upstream_error_code:code,error_class:status>=200&&status<300?null:classifyHuaweiError(code,message),auth_detail_class:status>=200&&status<300?"AUTHENTICATED":detailClass(message),response_truncated:raw.truncated===true,upstream_called:true,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph-raw-tls",transport:"node:tls-manual-http1",wire_shape:"official-listfunctions-empty-get",body_bytes:0,http_status:0,tls_authorized:false,authenticated:false,authorized:false,upstream_error_code:null,error_class:"HUAWEI_RAW_TLS_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",error_name:String(error?.name||"Error").slice(0,80),upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
