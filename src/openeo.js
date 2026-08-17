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

async function openEORequest(env,path,{method="GET",body,timeoutMs=20000}={}){
  const a=await accessToken(env);
  if(!a.configured)throw Object.assign(new Error("OPENEO_NOT_CONFIGURED"),{status:503});
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const headers={accept:"application/json",...authHeaders(a.token)};
    let payload;
    if(body!==undefined){headers["content-type"]="application/json";payload=JSON.stringify(body)}
    const r=await fetch(`${CORE_BASE}${path}`,{method,headers,body:payload,signal:c.signal});
    const text=await r.text();let data={};
    try{data=text?JSON.parse(text):{}}catch{data={raw:text.slice(0,500)}}
    if(!r.ok)throw Object.assign(new Error(`OPENEO_HTTP_${r.status}`),{status:r.status,details:data});
    return {status:r.status,data,identifier:r.headers.get("openeo-identifier"),location:r.headers.get("location"),costs:r.headers.get("openeo-costs")};
  }catch(e){
    if(e?.name==="AbortError")throw Object.assign(new Error("OPENEO_TIMEOUT"),{status:504});
    throw e;
  }finally{clearTimeout(timer)}
}

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

export async function startOpenEOAcceptanceJob(env){
  const graph={
    load:{process_id:"load_collection",arguments:{id:"COPERNICUS_30",spatial_extent:{west:4.35,south:50.84,east:4.352,north:50.842}}},
    reduce:{process_id:"reduce_dimension",arguments:{data:{from_node:"load"},dimension:"t",reducer:{process_graph:{max1:{process_id:"max",arguments:{data:{from_parameter:"data"}},result:true}}}}},
    save:{process_id:"save_result",arguments:{data:{from_node:"reduce"},format:"GTiff"},result:true}
  };
  const created=await openEORequest(env,"/jobs",{method:"POST",body:{title:"CDSE service-account link E2E 2026-08-17",description:"Minimal bounded Copernicus 30m DEM batch job for service-account credit-link verification.",process:{process_graph:graph},budget:10,log_level:"warning"}});
  const jobId=String(created.identifier||"");
  if(!jobId)throw Object.assign(new Error("OPENEO_JOB_IDENTIFIER_MISSING"),{status:502});
  const started=await openEORequest(env,`/jobs/${encodeURIComponent(jobId)}/results`,{method:"POST"});
  return {ok:true,job_id:jobId,create_status:created.status,start_status:started.status,budget_cap_credits:10,collection:"COPERNICUS_30",tiny_extent:true,secret_echo:false};
}

export async function getOpenEOAcceptanceJob(env,jobId){
  const id=String(jobId||"");
  if(!/^[\w\-.~]+$/.test(id))throw Object.assign(new Error("OPENEO_INVALID_JOB_ID"),{status:400});
  const r=await openEORequest(env,`/jobs/${encodeURIComponent(id)}`);
  const j=r.data||{};
  return {ok:true,job_id:id,status:String(j.status||"unknown"),progress:j.progress??null,costs:j.costs??null,usage:j.usage??null,created:j.created??null,updated:j.updated??null,secret_echo:false};
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
