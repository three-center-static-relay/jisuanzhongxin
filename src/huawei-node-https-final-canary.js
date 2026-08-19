import https from "node:https";
import {classifyHuaweiError,parseHuaweiFunctionUrn,signHuaweiRequest} from "./huawei-functiongraph.js";

const BODY="{}";
function parseJson(value){try{return JSON.parse(String(value||"{}"))}catch{return{}}}
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

function nodeHttpsGetWithBody(url,headers){
  return new Promise((resolve,reject)=>{
    const target=new URL(url);
    const request=https.request({protocol:"https:",hostname:target.hostname,port:443,path:`${target.pathname}${target.search}`,method:"GET",headers:{...headers,"content-length":String(Buffer.byteLength(BODY))}},response=>{
      response.setEncoding("utf8");
      let text="";
      response.on("data",chunk=>{text+=chunk});
      response.on("end",()=>resolve({status:Number(response.statusCode||0),body:text}));
    });
    request.on("error",reject);
    request.write(BODY);
    request.end();
  });
}

export async function probeHuaweiNodeHttpsFinal(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim(),sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-functiongraph-node-https",transport:"node:https",request_semantics:"get-with-json-object-body",body_bytes:2,http_status:0,authenticated:false,authorized:false,auth_detail_class:"PREFLIGHT_FAILED",upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false};
  const url=`https://functiongraph.${parsed.region}.myhuaweicloud.com/v2/${parsed.project_id}/fgs/functions?maxitems=1`;
  const baseHeaders={"content-type":"application/json","x-project-id":parsed.project_id};
  try{
    const signed=await signHuaweiRequest({method:"GET",url,headers:baseHeaders,body:BODY,ak,sk});
    const response=await nodeHttpsGetWithBody(url,{...baseHeaders,"x-sdk-date":signed.x_sdk_date,authorization:signed.authorization});
    const body=parseJson(response.body),code=upstreamCode(body),message=upstreamMessage(body);
    const rejected=response.status===401||code==="APIGW.0301"||code==="APIG.0301";
    return{ok:!rejected&&response.status>=200&&response.status<300,configured:true,provider:"huawei-functiongraph-node-https",transport:"node:https",request_semantics:"get-with-json-object-body",body_bytes:2,http_status:response.status,authenticated:!rejected&&response.status>0,authorized:response.status>=200&&response.status<300,upstream_error_code:code,error_class:response.status>=200&&response.status<300?null:classifyHuaweiError(code,message),auth_detail_class:response.status>=200&&response.status<300?"AUTHENTICATED":detailClass(message),upstream_called:true,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){return{ok:false,configured:true,provider:"huawei-functiongraph-node-https",transport:"node:https",request_semantics:"get-with-json-object-body",body_bytes:2,http_status:0,authenticated:false,authorized:false,upstream_error_code:null,error_class:"HUAWEI_TRANSPORT_OR_SIGNING_RUNTIME_ERROR",auth_detail_class:"TRANSPORT_ERROR",error_name:String(error?.name||"Error").slice(0,80),upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false}}
}
