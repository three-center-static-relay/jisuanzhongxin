export const CAPABILITY_ABI_VERSION="capability-abi-v1";

const verification=configured=>({status:configured?"configured-unverified":"unconfigured",scope:"configuration-only",verified_at:null,receipt_digest:null,sample_size:0});
const capability=(input,observedAt,configured)=>({
  id:input.id,type:input.type||"atomic",domain:input.domain,operations:input.operations,input_schema:input.input_schema||{type:"object"},output_schema:input.output_schema||{type:"object"},
  provider:"compute-worker",protocol:input.protocol||"service-binding",version:input.version||"1.0.0",auth_scope:"service-binding",permission_scope:"compute",network_scope:input.network_scope||"allowlisted-compute-backends",write_scope:"none",
  dependencies:input.dependencies||[],substitutes:input.substitutes||[],compatible_with:input.compatible_with||[],conflicts_with:input.conflicts_with||[],
  cost:{class:"provider-dependent",currency:"USD",unit_cost:null,estimate_status:"unknown"},latency:{class:input.latency||"job",timeout_ms:input.timeout_ms||900000},throughput:{class:"single-active-task",max_concurrency:1},
  reliability:{score:0,basis:"unverified-no-bound-runtime-receipt"},accuracy:{score:0,basis:"unverified-no-bound-runtime-receipt"},freshness:{observed_at:observedAt,ttl_seconds:1800},
  health:{status:configured?"configured-unverified":"unavailable",checked_at:observedAt},fitness:{quality:0,reliability:0,cost:0,latency:0,security:0,adaptability:0,complexity:0},
  trust:{level:"T0",status:configured?"unverified":"quarantined"},verification:verification(configured),license:"provider-specific",jurisdiction:["global"],first_seen:"2026-08-18T00:00:00.000Z",last_verified:null
});

export function computeCapabilityManifest({backends={}}={}){
  const observedAt=new Date().toISOString();
  const kaggleReady=backends?.kaggle?.route_eligible===true,earthReady=backends?.google_earth_engine?.route_eligible===true,openEOReady=backends?.copernicus_openeo?.route_eligible===true,wolframReady=backends?.wolfram_alpha?.route_eligible===true;
  const capabilities=[
    capability({id:"compute.cpu",domain:"compute",operations:["statistics.compute","simulation.run","optimization.run"]},observedAt,kaggleReady),
    capability({id:"compute.gpu",domain:"compute",operations:["gpu.compute","model.inference","matrix.accelerate"],dependencies:["compute.cpu"]},observedAt,kaggleReady),
    capability({id:"compute.geospatial-analysis",type:"composite",domain:"geospatial",operations:["geospatial.analyze","earth-observation.compute","datacube.process"],compatible_with:["intelligence.geospatial-evidence"],substitutes:earthReady&&openEOReady?["compute.geospatial-analysis.google-ee","compute.geospatial-analysis.openeo"]:[]},observedAt,earthReady||openEOReady),
    capability({id:"compute.simulation",type:"composite",domain:"simulation",operations:["monte-carlo.run","scenario.simulate","causal.compute"],dependencies:["compute.cpu"]},observedAt,kaggleReady),
    capability({id:"compute.optimization",type:"composite",domain:"optimization",operations:["optimization.solve","portfolio.optimize","route.optimize"],dependencies:["compute.cpu"]},observedAt,kaggleReady),
    capability({id:"compute.symbolic-knowledge",domain:"knowledge",operations:["symbolic.query","formula.solve","computational.knowledge"],network_scope:"wolfram-only"},observedAt,wolframReady)
  ];
  return{abi_version:CAPABILITY_ABI_VERSION,center:"compute",generated_at:observedAt,backend_summary:{configured:capabilities.filter(x=>x.health.status==="configured-unverified").length,runtime_verified:0},capabilities,ecology:[
    {from:"compute.gpu",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.simulation",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.optimization",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.geospatial-analysis",relation:"COMPLEMENTS",to:"intelligence.geospatial-evidence"}
  ]};
}
