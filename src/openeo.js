const TOKEN_URL="https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const CORE_BASE="https://openeo.dataspace.copernicus.eu/openeo/1.2";
const FED_BASE="https://openeofed.dataspace.copernicus.eu/openeo/1.2";
const OIDC_PROVIDER_ID="CDSE";
const OIDC_SCOPE="email openid";
let cached={access_token:"",expires_at:0};

function cfg(env){
  const clientId=String(env.CDSE_CLIENT_ID||"").trim();
  const clientSecret=String(env.CDSE_CLIENT_SECRET||"").trim();
  return {configured:Boolean(clientId&&clientSecret),clientId,clientSecret};
}

async function fetchJson(url,init={},timeoutMs=15000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...init,signal:c.signal,headers:{accept:"application/json",...(init.headers||{})}});
    const text=await r.text();let data={};
    try{data=text?JSON.parse(text):{}}catch{data={raw_json:false}}
    if(!r.ok)throw Object.assign(new Error(`OPENEO_HTTP_${r.status}`),{status:r.status,details:data});
    return data;
  }catch(e){
    if(e?.name==="AbortError")throw Object.assign(new Error("OPENEO_TIMEOUT"),{status:504});
    throw e;
  }finally{clearTimeout(timer)}
}

async function accessToken(env){
  const c=cfg(env);
  if(!c.configured)return {configured:false};
  const now=Math.floor(Date.now()/1000);
  if(cached.access_token&&cached.expires_at>now+60)return {configured:true,token:cached.access_token,cached:true};
  const body=new URLSearchParams({grant_type:"client_credentials",client_id:c.clientId,client_secret:c.clientSecret,scope:OIDC_SCOPE}).toString();
  const j=await fetchJson(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  if(!j.access_token)throw Object.assign(new Error("OPENEO_OAUTH_TOKEN_MISSING"),{status:502});
  const expires=Math.max(120,Number(j.expires_in)||300);
  cached={access_token:String(j.access_token),expires_at:now+expires};
  return {configured:true,token:cached.access_token,cached:false};
}

const authHeaders=t=>({authorization:`Bearer oidc/${OIDC_PROVIDER_ID}/${t}`});

export async function probeOpenEO(env,{federated=false}={}){
  const a=await accessToken(env);
  if(!a.configured)return {ok:false,configured:false,client_id_configured:Boolean(String(env.CDSE_CLIENT_ID||"").trim()),client_secret_configured:Boolean(String(env.CDSE_CLIENT_SECRET||"").trim()),secret_echo:false};
  const base=federated?FED_BASE:CORE_BASE;
  const me=await fetchJson(`${base}/me`,{headers:authHeaders(a.token)});
  const capabilities=await fetchJson(`${base}/`,{headers:authHeaders(a.token)});
  return {
    ok:true,
    configured:true,
    authenticated:true,
    endpoint:federated?"federation":"core-cdse",
    account_visible:Boolean(me?.user_id),
    budget_reported:me?.budget!==undefined,
    api_version:String(capabilities?.api_version||capabilities?.apiVersion||"unknown"),
    backend_id:String(capabilities?.id||""),
    token_cached:a.cached===true,
    secret_echo:false
  };
}

export async function describeOpenEOAccount(env){
  const a=await accessToken(env);
  if(!a.configured)throw Object.assign(new Error("OPENEO_NOT_CONFIGURED"),{status:503});
  const me=await fetchJson(`${CORE_BASE}/me`,{headers:authHeaders(a.token)});
  return {user_id:String(me?.user_id||""),budget:me?.budget??null,default_plan:me?.default_plan??null};
}

export const openEOMeta=()=>({
  core_endpoint:CORE_BASE,
  federation_endpoint:FED_BASE,
  auth:"oidc-client-credentials",
  oidc_provider_id:OIDC_PROVIDER_ID,
  oidc_scope:OIDC_SCOPE,
  machine_to_machine:true,
  generic_python:false,
  processing_class:"earth-observation-datacube"
});
