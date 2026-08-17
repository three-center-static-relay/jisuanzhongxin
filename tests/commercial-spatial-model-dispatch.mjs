import assert from "node:assert/strict";
import {canonicalModelId} from "../src/model-router.js";
import {recipeFor} from "../src/model-recipe-router.js";
import {commercialSpatialExecutableModelIds} from "../src/commercial-spatial-executable-models.js";

const ids=commercialSpatialExecutableModelIds();
assert.ok(ids.length>=10);
for(const id of ids){
  const resolved=canonicalModelId(id);
  assert.equal(resolved.canonical,id);
  assert.equal(resolved.source,"approved-recipe-catalog");
  const recipe=recipeFor(id);
  assert.ok(recipe,`missing recipe for ${id}`);
  assert.equal(recipe.model_id,id);
}
for(const alias of ["commercial_spatial_fusion","site_ranking","white_space","synthetic_od_gravity","trade_area_huff","footfall_proxy_nowcast","dwell_proxy_nowcast"]){
  const resolved=canonicalModelId(alias);
  assert.ok(resolved.canonical.endsWith(`.${alias}`),`${alias} did not resolve`);
  assert.ok(recipeFor(resolved.canonical),`${alias} resolved without recipe`);
}
assert.throws(()=>canonicalModelId("location_intelligence.not_a_real_recipe"),/UNKNOWN_MODEL/);
console.log(JSON.stringify({ok:true,suite:"commercial-spatial-model-dispatch",approved_model_ids:ids.length,aliases_verified:7,arbitrary_recipe_ids_denied:true}));
