import assert from "node:assert/strict";
import {planOpenEOHandoff,validateOpenEOHandoff,openEOMeta} from "../src/openeo.js";

const item={id:"S2B_MSIL2A_20260815T023529_N0512_R089_T50RQP_20260815T044636",collection:"sentinel-2-l2a",bbox:[119.1,25.9,119.5,26.3],properties:{datetime:"2026-08-15T02:35:29.024000Z",platform:"sentinel-2b"}};
const handoff={collection:item.collection,item_id:item.id,item_url:`https://stac.dataspace.copernicus.eu/v1/collections/${item.collection}/items/${item.id}`,compute_target:"copernicus-openeo",recommended_process:"load_stac"};
const input={handoff,item,bands:["B04","B08"]};

const plan=planOpenEOHandoff(input);
assert.equal(plan.ok,true);
assert.equal(plan.strategy,"native-load-collection-preferred");
assert.equal(plan.native_collection,"SENTINEL2_L2A");
assert.equal(plan.process_graph.load.process_id,"load_collection");
assert.equal(plan.process_graph.load.arguments.id,"SENTINEL2_L2A");
assert.deepEqual(plan.process_graph.load.arguments.spatial_extent,{west:119.1,south:25.9,east:119.5,north:26.3,crs:"EPSG:4326"});
assert.deepEqual(plan.process_graph.load.arguments.temporal_extent,["2026-08-15T00:00:00Z","2026-08-16T00:00:00Z"]);
assert.deepEqual(plan.process_graph.load.arguments.bands,["B04","B08"]);
assert.equal(plan.exact_item_fallback.process,"load_stac");
assert.equal(plan.exact_item_fallback.auto_execute,false);
assert.equal(plan.execution_started,false);
assert.equal(plan.credits_spent,false);
assert.match(plan.selection_precision,/not exact item-id execution/);
assert.equal(openEOMeta().native_collection_map["sentinel-1-grd"],"SENTINEL1_GRD");

assert.throws(()=>planOpenEOHandoff({...input,handoff:{...handoff,item_url:"https://example.com/item"}}),/STAC_ITEM_URL_NOT_CDSE/);
assert.throws(()=>planOpenEOHandoff({...input,handoff:{...handoff,collection:"unknown-collection"},item:{...item,collection:"unknown-collection"}}),/CDSE_COLLECTION_NOT_MAPPED/);
assert.throws(()=>planOpenEOHandoff({...input,bbox:[119.5,25.9,119.1,26.3]}),/INVALID_BBOX/);

const originalFetch=globalThis.fetch;
const seen={token:null,validation:null,authorization:null};
try{
  globalThis.fetch=async(url,init={})=>{
    const s=String(url);
    if(s.includes("/protocol/openid-connect/token")){seen.token=String(init.body||"");return new Response(JSON.stringify({access_token:"test-open-eo-token",expires_in:300}),{status:200,headers:{"content-type":"application/json"}})}
    if(s.endsWith("/openeo/1.2/validation")){seen.authorization=new Headers(init.headers||{}).get("authorization");seen.validation=JSON.parse(String(init.body||"{}"));return new Response(JSON.stringify({errors:[]}),{status:200,headers:{"content-type":"application/json"}})}
    throw new Error(`UNEXPECTED_FETCH:${s}`);
  };
  const validated=await validateOpenEOHandoff({CDSE_CLIENT_ID:"client",CDSE_CLIENT_SECRET:"secret"},input);
  assert.equal(validated.validation_ok,true);
  assert.equal(validated.validation_executes_process,false);
  assert.equal(validated.execution_started,false);
  assert.equal(validated.credits_spent,false);
  assert.equal(seen.authorization,"Bearer oidc/CDSE/test-open-eo-token");
  assert.match(seen.token,/grant_type=client_credentials/);
  assert.match(seen.token,/scope=email(?:\+|%20)openid/);
  assert.equal(seen.validation.process_graph.load.arguments.id,"SENTINEL2_L2A");
} finally {globalThis.fetch=originalFetch}

console.log(JSON.stringify({ok:true,suite:"openeo-intelligence-handoff",native_mapping:true,official_stac_only:true,load_collection_preferred:true,load_stac_fallback_not_autoexecuted:true,validation_no_execution:true,no_credit_spend:true}));
