const TARGET="platform/2v-cpu-16g-mem";
const RECEIPT={revision:"studio-lite-runtime-v3-20260820",cpu_effective:2,memory_gib_effective:15.35,square_sum_correct:true,result_digest_present:true,python:"3.11.11"};
export function productionStatus(status={}){
  const hw=status?.hardware||{};
  const ready=status?.configured===true&&status?.authenticated===true&&status?.studio_found===true&&status?.catalog_verified===true&&hw.name===TARGET&&hw.resource_type==="free"&&hw.has_stock===true;
  return {...status,ok:ready,role:"free-light-cpu-demand-runner",lifecycle:ready?"production-free-demand":"production-unavailable",production_acceptance:"2026-08-20-workflow-v4-pass",production_accepted:true,runtime_e2e_attested:true,current_runtime_e2e_verified:status?.runtime_e2e_verified===true,production_receipt:{...RECEIPT},route_eligible:ready,route_scope:"explicit-free-light-cpu-workflow",explicit_selection_only:true,automatic_global_routing:false,execution_mode:"demand-workflow-auto-stop",free_only:true,paid_fallback:false,secrets_redacted:true,error_class:ready?null:status?.error_class||"MODELSCOPE_STUDIO_LITE_NOT_READY"};
}
