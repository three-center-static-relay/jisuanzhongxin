const TOKEN_URL="https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const CORE_BASE="https://openeo.dataspace.copernicus.eu/openeo/1.2";
const FED_BASE="https://openeofed.dataspace.copernicus.eu/openeo/1.2";
const OIDC_PROVIDER_ID="CDSE";
const OIDC_SCOPE="email openid";
const CDSE_STAC_BASE="https://stac.dataspace.copernicus.eu/v1";
const HANDOFF_VERSION="copernicus-intelligence-openeo-handoff-v1-20260817";
const NATIVE_COLLECTIONS=Object.freeze({
  "sentinel-2-l2a":"SENTINEL2_L2A",
  "sentinel-2-l1c":"SENTINEL2_L1C",
  "sentinel-1-grd":"SENTINEL1_GRD"
});
let cached={access_token:"",expires_at:0};

function cfg(env){
  const clientId=String(env.CDSE_CLIENT_ID||"").trim();
  const clientSecret=String(env.CDSE_CLIENT_SECRET||"").trim();
  return {configured:Boolean(clientId&&clientSecret),clientId,clientSecret};
}

function fail(message,status=400,details){throw Object.assign(new Error(message),{status,details})}
function safeId(v,name="id",max=240){const s=String(v??"").trim().slice(0,max);if(!s||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s))fail(`INVALID_${name.toUpperCase()}`,400);return s}
function safeBand(v){const s=String(v??"").trim();if(!/^[A-Za-z0-9_:-]{1,40}$/.test(s))fail("INVALID_BAND",400);return s}
function safeBbox(v){if(!Array.isArray(v)||v.length!==4)fail("INVALID_BBOX",400);const a=v.map(Number);if(a.some(x=>!Number.isFinite(x)))fail("INVALID_BBOX",400);const[w,s,e,n]=a;if(w<-180||e>180||s<-90||n>90||w>=e||s>=n)fail("INVALID_BBOX",400);return a}
function safeStacItemUrl(v,collection,itemId){const s=String(v??"").trim();if(!s)return null;let u;try{u=new URL(s)}catch{fail("INVALID_STAC_ITEM_URL",400)}if(u.protocol!=="https:"||u.hostname!=="stac.dataspace.copernicus.eu")fail("STAC_ITEM_URL_NOT_CDSE",403);const expected=`/v1/collections/${encodeURIComponent(collection)}/items/${encodeURIComponent(itemId)}`;if(u.pathname!==expected||u.search||u.hash)fail("STAC_ITEM_URL_MISMATCH",400);return u.toString()}
function parseTemporal(v){if(Array.isArray(v)&&v.length===2){const a=v.map(x=>String(x??"").trim());if(a.some(x=>!/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?$/.test(x)))fail("INVALID_TEMPORAL_EXTENT",400);return a}const s=String(v??"").trim();if(!s)return null;if(!/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?$/.test(s))fail("INVALID_DATETIME",400);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return[s,s];const d=s.slice(0,10),start=`${d}T00:00:00Z`,next=new Date(`${d}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);return[start,next.toISOString().replace(".000Z","Z")]}
function normalizeHandoff(input={}){
  const handoff=input?.handoff&&typeof input.handoff==="object"?input.handoff:{};
  const item=input?.item&&typeof input.item==="object"?input.item:{};
  const collection=safeId(input.collection||handoff.collection||item.collection,"collection",120).toLowerCase();
  const native=NATIVE_COLLECTIONS[collection];if(!native)fail("CDSE_COLLECTION_NOT_MAPPED",400,{collection,known:Object.keys(NATIVE_COLLECTIONS)});
  const itemId=safeId(input.item_id||handoff.item_id||item.id,"item",240);
  const itemUrl=safeStacItemUrl(input.item_url||handoff.item_url||`${CDSE_STAC_BASE}/collections/${collection}/items/${itemId}`,collection,itemId);
  const box=safeBbox(input.bbox||item.bbox);
  const temporal=parseTemporal(input.temporal_extent||input.datetime||item?.properties?.datetime||item?.properties?.start_datetime);
  if(!temporal)fail("TEMPORAL_EXTENT_REQUIRED",400);
  const bands=(Array.isArray(input.bands)?input.bands:[]).slice(0,12).map(safeBand);
  return{collection,native_collection:native,item_id:itemId,item_url:itemUrl,bbox:box,temporal_extent:temporal,bands};
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

export function planOpenEOHandoff(input={}){
  const h=normalizeHandoff(input),args={id:h.native_collection,spatial_extent:{west:h.bbox[0],south:h.bbox[1],east:h.bbox[2],north:h.bbox[3],crs:"EPSG:4326"},temporal_extent:h.temporal_extent};if(h.bands.length)args.bands=h.bands;
  const process_graph={load:{process_id:"load_collection",arguments:args,result:true}};
  return{ok:true,handoff_version:HANDOFF_VERSION,source:"intelligence-center-copernicus-cdse-stac",target:"compute-center-copernicus-openeo",strategy:"native-load-collection-preferred",native_collection:h.native_collection,stac_collection:h.collection,item_id:h.item_id,item_url:h.item_url,bbox:h.bbox,temporal_extent:h.temporal_extent,bands:h.bands,selection_precision:"spatiotemporal-native-collection; canonical STAC item retained as provenance, not exact item-id execution",process_graph,exact_item_fallback:{process:"load_stac",url:h.item_url,auto_execute:false,reason:"CDSE STAC asset references may require OIDC/S3 authentication that openEO validation does not guarantee at execution time"},execution_started:false,credits_spent:false};
}

export async function validateOpenEOHandoff(env,input={}){
  const plan=planOpenEOHandoff(input),a=await accessToken(env);if(!a.configured)throw Object.assign(new Error("OPENEO_NOT_CONFIGURED"),{status:503});
  const out=await fetchJson(`${CORE_BASE}/validation`,{method:"POST",headers:{...authHeaders(a.token),"content-type":"application/json"},body:JSON.stringify({process_graph:plan.process_graph})});
  const errors=Array.isArray(out?.errors)?out.errors:[];
  return{...plan,validated:true,validation_ok:errors.length===0,validation_errors:errors.slice(0,20).map(x=>({code:String(x?.code||""),message:String(x?.message||"").slice(0,1000),path:x?.path??null})),validation_endpoint:"core-cdse",validation_executes_process:false,token_cached:a.cached===true,secret_echo:false};
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

export const openEOMeta=()=>({
  core_endpoint:CORE_BASE,
  federation_endpoint:FED_BASE,
  auth:"oidc-client-credentials",
  oidc_provider_id:OIDC_PROVIDER_ID,
  oidc_scope:OIDC_SCOPE,
  machine_to_machine:true,
  generic_python:false,
  processing_class:"earth-observation-datacube",
  handoff_version:HANDOFF_VERSION,
  intelligence_handoff:true,
  native_collection_map:{...NATIVE_COLLECTIONS},
  native_load_collection_preferred:true,
  exact_item_load_stac_auto_execute:false
});
