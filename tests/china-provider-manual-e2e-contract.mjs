import fs from "node:fs";

const pkg=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const aliyun=fs.readFileSync(new URL("../src/aliyun-fc-sandbox.js",import.meta.url),"utf8");
const baidu=fs.readFileSync(new URL("../src/baidu-manual-acceptance.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/production-entry.js",import.meta.url),"utf8");

if(pkg.dependencies?.e2b!=="2.35.3")throw new Error("E2B_SDK_MUST_BE_PINNED_2_35_3");
for(const token of ["code-interpreter-v1","timeoutMs:60000","sandbox.kill()","paid_execution:true","explicit_paid_ack_required:true","automatic_global_routing:false","paid_fallback:false",'production_routing:"explicit-only"',"PAID_EXECUTION_ACK_REQUIRED","x-three-center-acceptance-token","MANUAL_ACCEPTANCE_TOKEN_SHA256"]){if(!aliyun.includes(token))throw new Error(`ALIYUN_ACCEPTANCE_MISSING_${token}`)}
for(const token of ["payment:\"coupon\"","acoin_allowed:false","paid_fallback:false","sdk_version:\"0.3.9\"","x-three-center-acceptance-token","MANUAL_ACCEPTANCE_TOKEN_SHA256"]){if(!baidu.includes(token))throw new Error(`BAIDU_ACCEPTANCE_MISSING_${token}`)}
if(!entry.includes("maybeHandleBaiduManualAcceptance"))throw new Error("BAIDU_MANUAL_ACCEPTANCE_NOT_WIRED");
if(/Lq2GE-QZunDwjQpOaISvcNU4p-kfbnYbgCoVeUSgo5I|LWpI0-nVRA69HEDRsD7UuvmIS3nOhuXFIeGX3GVTsvg/.test(aliyun+baidu))throw new Error("PLAINTEXT_ACCEPTANCE_TOKEN_COMMITTED");
if(/secret_echo\s*:\s*true/.test(aliyun+baidu))throw new Error("SECRET_ECHO_ENABLED");
console.log("china-provider-manual-e2e-contract: PASS");
