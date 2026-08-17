export const COMMERCIAL_SPATIAL_EXCHANGE_VERSION="commercial-spatial-evidence-v1-20260817";
export const COMMERCIAL_SPATIAL_EVIDENCE_KINDS=Object.freeze(["observed","derived","inferred","hypothesis"]);
const HEX64=/^[0-9a-f]{64}$/;
const FORBIDDEN_KEYS=/^(imei|imsi|idfa|gaid|device_?id|phone_?number|msisdn|raw_?trajectory|precise_?person_?location)$/i;
function fail(message,status=400,details){throw Object.assign(new Error(message),{status,details})}
function walk(value,path="$"){
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],`${path}[${i}]`);return}
  if(!value||typeof value!=="object")return;
  for(const[k,v]of Object.entries(value)){if(FORBIDDEN_KEYS.test(k))fail("PERSONAL_OR_DEVICE_LEVEL_FIELD_DENIED",400,{path:`${path}.${k}`});walk(v,`${path}.${k}`)}
}
function validateReceipt(r){const source=String(r?.source||r?.source_id||"").trim(),digest=String(r?.digest_sha256||r?.result_digest||"").toLowerCase();if(!source||!HEX64.test(digest))fail("INVALID_SOURCE_RECEIPT",400,{source,digest_present:Boolean(digest)});return{...r,source,digest_sha256:digest}}
export function validateCommercialSpatialHandoff(args={}){
  walk(args);
  const bundle=args.evidence_bundle;
  if(bundle!==undefined){
    if(!bundle||typeof bundle!=="object")fail("INVALID_COMMERCIAL_SPATIAL_BUNDLE");
    if(bundle.contract_version!==COMMERCIAL_SPATIAL_EXCHANGE_VERSION)fail("COMMERCIAL_SPATIAL_CONTRACT_VERSION_MISMATCH",400,{expected:COMMERCIAL_SPATIAL_EXCHANGE_VERSION,observed:bundle.contract_version});
    const records=Array.isArray(bundle.records)?bundle.records:[];
    if(records.length<1||records.length>2000)fail("INVALID_COMMERCIAL_SPATIAL_RECORD_COUNT",400,{min:1,max:2000});
    for(const r of records){const kind=String(r?.evidence_kind||"").toLowerCase();if(!COMMERCIAL_SPATIAL_EVIDENCE_KINDS.includes(kind))fail("INVALID_EVIDENCE_KIND",400,{kind});if(kind!=="observed"&&r?.observed===true)fail("INFERENCE_PROMOTED_TO_OBSERVED");if((kind==="inferred"||kind==="hypothesis")&&!r?.quality?.uncertainty)fail("INFERENCE_UNCERTAINTY_REQUIRED",400,{record_id:r?.record_id})}
  }
  const receipts=Array.isArray(args.source_receipts)?args.source_receipts:(Array.isArray(bundle?.source_receipts)?bundle.source_receipts:[]);
  if(receipts.length<1||receipts.length>64)fail("SOURCE_RECEIPTS_REQUIRED",400,{min:1,max:64});
  const normalized=receipts.map(validateReceipt);
  return{shared_bundle:Boolean(bundle),contract_version:bundle?.contract_version||COMMERCIAL_SPATIAL_EXCHANGE_VERSION,source_receipts:normalized,record_count:Array.isArray(bundle?.records)?bundle.records.length:0};
}

export const COMMERCIAL_SPATIAL_HANDOFF_POLICY=Object.freeze({
  contract_version:COMMERCIAL_SPATIAL_EXCHANGE_VERSION,
  cross_center:true,
  cross_branch:true,
  raw_person_or_device_trajectories:false,
  personal_identifiers:false,
  inferred_promoted_to_observed:false,
  public_aggregate_mobility_is_phone_lbs:false,
  modelled_od_is_observed_od:false,
  modelled_dwell_is_observed_dwell:false,
  modelled_footfall_is_observed_footfall:false,
  source_receipts_required:true,
  uncertainty_required_for_inference:true
});
