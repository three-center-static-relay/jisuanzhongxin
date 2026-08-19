import assert from "node:assert/strict";

// Temporary one-bit Cloudflare build oracle. No secret values or raw IAM messages are printed.
const url="https://compute-worker.a15280020511.workers.dev/v1/providers/huawei-functiongraph/health?fresh=1";
const response=await fetch(url,{headers:{"cache-control":"no-cache"}});
const body=await response.json();
const safe={
  ok:body?.ok===true,
  configured:body?.configured===true,
  http_status:Number(body?.http_status||0),
  upstream_error_code:String(body?.upstream_error_code||""),
  error_class:String(body?.error_class||""),
  acceptance_state:String(body?.acceptance_state||""),
  cached_health:body?.cached_health===true,
  fresh_probe_requested:body?.fresh_probe_requested===true,
  refresh_suppressed:body?.refresh_suppressed===true,
  secret_echo:body?.secret_echo===true
};
console.log("HUAWEI_HEALTH_SAFE",JSON.stringify(safe));
assert.equal(safe.fresh_probe_requested,true);
assert.equal(safe.refresh_suppressed,false);
assert.equal(safe.secret_echo,false);
assert.equal(safe.error_class,"HUAWEI_AK_TEMP_LOCKED_OR_RESTRICTED","oracle-temp-lock=false");
console.log("PASS huawei-health-oracle-temp-lock");
