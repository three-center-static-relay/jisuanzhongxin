import assert from "node:assert/strict";
import {probeEarthEngine} from "../src/google-ee.js";

const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const pkcs8=await crypto.subtle.exportKey("pkcs8",pair.privateKey);
const b64=Buffer.from(pkcs8).toString("base64").match(/.{1,64}/g).join("\n");
const privateKey=`-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
const serviceAccount={client_email:"unit-test@cloud-project.iam.gserviceaccount.com",private_key:privateKey,project_id:"embedded-project",token_uri:"https://oauth2.googleapis.com/token"};
const realFetch=globalThis.fetch;
let tokenCalls=0,configCalls=0;

globalThis.fetch=async(url,init={})=>{
  const u=String(url);
  if(u==="https://oauth2.googleapis.com/token"){
    tokenCalls++;
    assert.equal(String(init.method||"GET"),"POST");
    const form=new URLSearchParams(String(init.body||""));
    assert.equal(form.get("grant_type"),"urn:ietf:params:oauth:grant-type:jwt-bearer");
    assert.ok((form.get("assertion")||"").split(".").length===3);
    return Response.json({access_token:`unit-token-${tokenCalls}`,token_type:"Bearer",expires_in:3600});
  }
  if(u.startsWith("https://earthengine.googleapis.com/v1/projects/")&&u.endsWith("/config")){
    configCalls++;
    assert.equal(init.headers?.authorization,`Bearer unit-token-${tokenCalls}`);
    return Response.json({registrationState:"REGISTERED"});
  }
  throw new Error(`unexpected fetch ${u}`);
};

try{
  const cloud=await probeEarthEngine({GOOGLE_CLOUD_CREDENTIALS:JSON.stringify(serviceAccount),GOOGLE_CLOUD_PROJECT:"cloud-project"});
  assert.equal(cloud.ok,true);
  assert.equal(cloud.configured,true);
  assert.equal(cloud.oauth,true);
  assert.equal(cloud.credential_source,"google-cloud-standard");
  assert.equal(cloud.project_source,"google-cloud-env");
  assert.equal(cloud.registration_state,"REGISTERED");

  const legacy=await probeEarthEngine({GOOGLE_EE_SERVICE_ACCOUNT_JSON:JSON.stringify(serviceAccount),GOOGLE_EE_PROJECT_ID:"legacy-project"});
  assert.equal(legacy.ok,true);
  assert.equal(legacy.credential_source,"google-ee-specific");
  assert.equal(legacy.project_source,"google-ee-env");

  const embedded=await probeEarthEngine({GOOGLE_CLOUD_CREDENTIALS:JSON.stringify(serviceAccount)});
  assert.equal(embedded.ok,true);
  assert.equal(embedded.credential_source,"google-cloud-standard");
  assert.equal(embedded.project_source,"service-account-json");
  assert.equal(tokenCalls,3);
  assert.equal(configCalls,3);

  console.log(JSON.stringify({ok:true,suite:"google-cloud-credential-unification",standard_credentials:true,standard_project:true,legacy_compatible:true,embedded_project_fallback:true}));
}finally{globalThis.fetch=realFetch}
