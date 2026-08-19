const EXPECTED_DATE="20260820T012345Z";
const EXPECTED_AUTH="SDK-HMAC-SHA256 Access=DUMMY, SignedHeaders=x-sdk-date, Signature=DUMMY";
const EXPECTED_MARKER="cf-huawei-header-integrity";

export async function probeHuaweiEgressHeaderIntegrity(){
  try{
    const response=await fetch("https://postman-echo.com/headers",{method:"GET",headers:{"x-sdk-date":EXPECTED_DATE,"authorization":EXPECTED_AUTH,"x-diag-marker":EXPECTED_MARKER}});
    const body=await response.json().catch(()=>({}));
    const headers=body?.headers&&typeof body.headers==="object"?body.headers:{};
    const normalized=Object.fromEntries(Object.entries(headers).map(([k,v])=>[String(k).toLowerCase(),String(v)]));
    return{ok:response.ok,provider:"huawei-egress-header-integrity",http_status:response.status,x_sdk_date_preserved:normalized["x-sdk-date"]===EXPECTED_DATE,authorization_preserved:normalized.authorization===EXPECTED_AUTH,marker_preserved:normalized["x-diag-marker"]===EXPECTED_MARKER,used_real_credentials:false,upstream:"public-header-echo",route_eligible:false,paid_fallback:false,secret_echo:false};
  }catch{return{ok:false,provider:"huawei-egress-header-integrity",http_status:0,x_sdk_date_preserved:false,authorization_preserved:false,marker_preserved:false,used_real_credentials:false,error_class:"EGRESS_HEADER_INTEGRITY_TRANSPORT_ERROR",route_eligible:false,paid_fallback:false,secret_echo:false}}
}
