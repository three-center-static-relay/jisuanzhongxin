export const COMMERCIAL_SPATIAL_EXECUTABLE_MODEL_CATALOG_VERSION="commercial-spatial-executable-v1-20260817";
export const COMMERCIAL_SPATIAL_EXECUTABLE_MODEL_IDS=Object.freeze({
  "location_intelligence.commercial_spatial_fusion":{method:"commercial_spatial_fusion",recipe_family:"commercial_spatial_fusion"},
  "location_intelligence.spatial_feature_fusion":{method:"spatial_feature_fusion",recipe_family:"geospatial_commercial_feature_fusion"},
  "location_intelligence.site_ranking":{method:"site_ranking",recipe_family:"geospatial_commercial_feature_fusion"},
  "location_intelligence.white_space":{method:"white_space",recipe_family:"geospatial_commercial_feature_fusion"},
  "location_intelligence.competitor_diversion":{method:"competitor_diversion",recipe_family:"commercial_spatial_fusion"},
  "location_intelligence.spatial_gap_gp":{method:"spatial_gap_gp",recipe_family:"commercial_spatial_advanced_v1"},
  "location_intelligence.synthetic_od_gravity":{method:"synthetic_od_gravity",recipe_family:"commercial_spatial_advanced_v1"},
  "location_intelligence.trade_area_huff":{method:"trade_area_huff",recipe_family:"commercial_spatial_advanced_v1"},
  "location_intelligence.footfall_proxy_nowcast":{method:"footfall_proxy_nowcast",recipe_family:"commercial_spatial_advanced_v1"},
  "location_intelligence.dwell_proxy_nowcast":{method:"dwell_proxy_nowcast",recipe_family:"commercial_spatial_advanced_v1"}
});
export const commercialSpatialExecutableModelIds=()=>Object.keys(COMMERCIAL_SPATIAL_EXECUTABLE_MODEL_IDS);
export function commercialSpatialExecutableModel(id){return COMMERCIAL_SPATIAL_EXECUTABLE_MODEL_IDS[String(id||"").trim()]||null}
