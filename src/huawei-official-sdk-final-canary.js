import * as core from "@huaweicloud/huaweicloud-sdk-core";
import * as functiongraph from "@huaweicloud/huaweicloud-sdk-functiongraph/v2/public-api";
import {parseHuaweiFunctionUrn} from "./huawei-functiongraph.js";

const SDK_VERSION="3.1.209";
function detailClass(message){
  const msg=String(message||"").toLowerCase();
  if(msg.includes("x-auth-token"))return"X_AUTH_TOKEN_MISSING";
  if(msg.includes("secretkey")||msg.includes("ak not exist"))return"AK_NOT_FOUND_OR_SECRET_LOOKUP_FAILED";
  if(msg.includes("signature")||msg.includes("sign fail")||msg.includes("verify aksk"))return"SIGNATURE_RELATED";
  if(msg.includes("reach the limit")||msg.includes("forbidden"))return"AK_RESTRICTED_OR_RATE_LIMITED";
  if(msg.includes("incorrect iam authentication information"))return"IAM_AUTH_RECOGNIZED_UNCLASSIFIED";
  return msg?"OTHER_AUTH_ERROR":"NO_AUTH_DETAIL";
}

export async function probeHuaweiOfficialSdkFinal(env={}){
  const parsed=parseHuaweiFunctionUrn(env.HUAWEI_FUNCTION_URN);
  const ak=String(env.HUAWEI_CLOUD_AK||"").trim();
  const sk=String(env.HUAWEI_CLOUD_SK||"").trim();
  if(!parsed.ok||!ak||!sk)return{ok:false,configured:false,provider:"huawei-functiongraph-official-sdk",official_sdk_used:true,official_sdk_version:SDK_VERSION,http_status:0,authenticated:false,authorized:false,auth_detail_class:"PREFLIGHT_FAILED",upstream_called:false,route_eligible:false,paid_fallback:false,secret_echo:false};
  try{
    const credentials=new core.BasicCredentials().withAk(ak).withSk(sk).withProjectId(parsed.project_id);
    const client=functiongraph.FunctionGraphClient.newBuilder()
      .withCredential(credentials)
      .withEndpoint(`https://functiongraph.${parsed.region}.myhuaweicloud.com`)
      .build();
    const request=new functiongraph.ListFunctionsRequest();
    request.maxitems="1";
    const result=await client.listFunctions(request);
    const status=Number(result?.httpStatusCode||200);
    return{ok:status>=200&&status<300,configured:true,provider:"huawei-functiongraph-official-sdk",official_sdk_used:true,official_sdk_version:SDK_VERSION,http_status:status,authenticated:status!==401,authorized:status>=200&&status<300,function_list_present:Array.isArray(result?.functions),upstream_called:true,route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch(error){
    const status=Number(error?.httpStatusCode||error?.statusCode||0);
    const code=String(error?.errorCode||error?.code||"").slice(0,80)||null;
    const detail=detailClass(error?.errorMsg||error?.message);
    const authRejected=status===401||code==="APIGW.0301"||code==="APIG.0301";
    return{ok:false,configured:true,provider:"huawei-functiongraph-official-sdk",official_sdk_used:true,official_sdk_version:SDK_VERSION,http_status:status,authenticated:status>0&&!authRejected,authorized:false,upstream_error_code:code,auth_detail_class:detail,error_name:String(error?.name||"Error").slice(0,80),upstream_called:status>0,route_eligible:false,paid_fallback:false,secret_echo:false};
  }
}
