export const CAPABILITY_ABI_VERSION="capability-abi-v1";

const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const capability=(input,observedAt)=>({
  id:input.id,type:input.type||"atomic",domain:input.domain,operations:input.operations,input_schema:input.input_schema||{type:"object"},output_schema:input.output_schema||{type:"object"},
  provider:"compute-worker",protocol:input.protocol||"service-binding",version:input.version||"1.0.0",auth_scope:"service-binding",permission_scope:"compute",network_scope:input.network_scope||"allowlisted-compute-backends",write_scope:"none",
  dependencies:input.dependencies||[],substitutes:input.substitutes||[],compatible_with:input.compatible_with||[],conflicts_with:input.conflicts_with||[],
  cost:{class:"free-first-no-paid-fallback",currency:"USD",unit_cost:0},latency:{class:input.latency||"job",timeout_ms:input.timeout_ms||900000},throughput:{class:"single-active-task",max_concurrency:1},
  reliability:{score:clamp(input.reliability??0.75),basis:"runtime-readiness-and-receipts"},accuracy:{score:clamp(input.accuracy??0.8),basis:"deterministic-result-validation"},freshness:{observed_at:observedAt,ttl_seconds:1800},
  health:{status:input.health||"ready",checked_at:observedAt},fitness:{quality:clamp(input.accuracy??0.8),reliability:clamp(input.reliability??0.75),cost:0.95,latency:0.45,security:0.9,adaptability:0.82,complexity:0.55},
  trust:{level:"T2",status:input.health==="unavailable"?"quarantined":"verified"},license:"provider-specific",jurisdiction:["global"],first_seen:"2026-08-18T00:00:00.000Z",last_verified:observedAt
});

export function computeCapabilityManifest({backends={}}={}){
  const observedAt=new Date().toISOString();
  const kaggleReady=backends?.kaggle?.route_eligible===true,earthReady=backends?.google_earth_engine?.route_eligible===true,openEOReady=backends?.copernicus_openeo?.route_eligible===true,wolframReady=backends?.wolfram_alpha?.route_eligible===true;
  const capabilities=[
    capability({id:"compute.cpu",domain:"compute",operations:["statistics.compute","simulation.run","optimization.run"],health:kaggleReady?"ready":"unavailable",reliability:0.86,accuracy:0.9},observedAt),
    capability({id:"compute.gpu",domain:"compute",operations:["gpu.compute","model.inference","matrix.accelerate"],health:kaggleReady?"ready":"unavailable",dependencies:["compute.cpu"],reliability:0.82,accuracy:0.88},observedAt),
    capability({id:"compute.geospatial-analysis",type:"composite",domain:"geospatial",operations:["geospatial.analyze","earth-observation.compute","datacube.process"],health:earthReady||openEOReady?"ready":"unavailable",compatible_with:["intelligence.geospatial-evidence"],substitutes:earthReady&&openEOReady?["compute.geospatial-analysis.google-ee","compute.geospatial-analysis.openeo"]:[],reliability:0.8,accuracy:0.86},observedAt),
    capability({id:"compute.simulation",type:"composite",domain:"simulation",operations:["monte-carlo.run","scenario.simulate","causal.compute"],health:kaggleReady?"ready":"unavailable",dependencies:["compute.cpu"],reliability:0.84,accuracy:0.88},observedAt),
    capability({id:"compute.optimization",type:"composite",domain:"optimization",operations:["optimization.solve","portfolio.optimize","route.optimize"],health:kaggleReady?"ready":"unavailable",dependencies:["compute.cpu"],reliability:0.84,accuracy:0.9},observedAt),
    capability({id:"compute.symbolic-knowledge",domain:"knowledge",operations:["symbolic.query","formula.solve","computational.knowledge"],health:wolframReady?"ready":"unavailable",network_scope:"wolfram-only",reliability:0.75,accuracy:0.84},observedAt)
  ];
  return{abi_version:CAPABILITY_ABI_VERSION,center:"compute",generated_at:observedAt,capabilities,ecology:[
    {from:"compute.gpu",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.simulation",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.optimization",relation:"REQUIRES",to:"compute.cpu"},
    {from:"compute.geospatial-analysis",relation:"COMPLEMENTS",to:"intelligence.geospatial-evidence"}
  ]};
}
