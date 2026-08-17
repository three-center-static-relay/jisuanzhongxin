import {KAGGLE_ACCEPTANCE_HISTORY} from "./kaggle-acceptance-history.js";

const SUMMARY_PATHS=new Set(["/health","/v1/capabilities","/capabilities"]);
const KAGGLE_HISTORICAL_STATE="historical-cpu-t4-e2e-live-health-required";
const MODAL_HISTORICAL_STATE="historical-cpu-t4-e2e-live-health-required";

export function normalizeKaggleMeta(body={}){
  return {...body,
    historically_verified:true,
    business_e2e:false,
    business_e2e_current:false,
    business_e2e_historically_verified:true,
    current_live_health_verified:false,
    route_eligible:false,
    route_eligibility:"live-health-required",
    acceptance_state:KAGGLE_HISTORICAL_STATE,
    latest_recipe_acceptance:KAGGLE_ACCEPTANCE_HISTORY.latest_recipe_attempt
  };
}

export function normalizeKaggleHealth(body={}){
  const live=body?.ok===true&&body?.authenticated===true;
  return {...body,
    historically_verified:true,
    business_e2e:false,
    business_e2e_current:false,
    business_e2e_historically_verified:true,
    current_live_health_verified:live,
    route_eligible:live&&body?.route_eligible===true,
    acceptance_state:live?"live-auth-health-pass-historical-cpu-t4-e2e":"live-health-failed",
    latest_recipe_acceptance:KAGGLE_ACCEPTANCE_HISTORY.latest_recipe_attempt
  };
}

export function normalizeModalMeta(body={}){
  return {...body,
    historically_verified:true,
    historical_cpu_t4_e2e_verified:true,
    current_cpu_t4_e2e_verified:false,
    current_live_health_verified:false,
    route_eligible:false,
    route_eligibility:"live-health-required",
    acceptance_state:MODAL_HISTORICAL_STATE
  };
}

export function normalizeModalHealth(body={}){
  const live=body?.ok===true&&body?.authenticated===true;
  return {...body,
    historically_verified:true,
    historical_cpu_t4_e2e_verified:true,
    current_cpu_t4_e2e_verified:false,
    current_live_health_verified:live,
    route_eligible:live&&body?.route_eligible===true,
    acceptance_state:live?"live-health-pass-historical-cpu-t4-e2e":(body?.acceptance_state||"live-health-failed")
  };
}

function normalizeSummary(body){
  const out={...body};
  if(out.compute_backends&&typeof out.compute_backends==="object"){
    out.compute_backends={...out.compute_backends};
    if(out.compute_backends.kaggle){
      out.compute_backends.kaggle={...out.compute_backends.kaggle,
        historically_verified:true,
        business_e2e_current:false,
        business_e2e_historically_verified:true,
        current_live_health_verified:false,
        route_eligible:false,
        route_eligibility:"live-health-required",
        acceptance_state:KAGGLE_HISTORICAL_STATE,
        latest_recipe_acceptance:KAGGLE_ACCEPTANCE_HISTORY.latest_recipe_attempt
      };
    }
    if(out.compute_backends.modal){
      out.compute_backends.modal={...out.compute_backends.modal,
        historically_verified:true,
        historical_cpu_t4_e2e_verified:true,
        current_cpu_t4_e2e_verified:false,
        current_live_health_verified:false,
        route_eligible:false,
        route_eligibility:"live-health-required",
        acceptance_state:MODAL_HISTORICAL_STATE
      };
    }
  }
  if(out.capabilities&&typeof out.capabilities==="object"){
    out.capabilities={...out.capabilities,
      kaggle_current_cpu_t4_e2e_verified:false,
      kaggle_historical_cpu_t4_e2e_verified:true,
      modal_current_cpu_t4_e2e_verified:false,
      modal_historical_cpu_t4_e2e_verified:true
    };
  }
  return out;
}

export function normalizeProviderTruth(path,body){
  if(!body||typeof body!=="object")return body;
  if(path==="/v1/providers/kaggle/meta")return normalizeKaggleMeta(body);
  if(path==="/v1/providers/kaggle/health")return normalizeKaggleHealth(body);
  if(SUMMARY_PATHS.has(path))return normalizeSummary(body);
  if(path==="/v1/acceptance/latest"&&body.providers&&typeof body.providers==="object"){
    return {...body,providers:{...body.providers,
      kaggle:"historical-cpu-t4-e2e-live-health-required-current-e2e-not-asserted-latest-recipe-task-not-created",
      modal:"historical-cpu-t4-e2e-live-health-required-bounded-route-current-e2e-not-asserted"
    }};
  }
  return body;
}

export async function patchProviderTruthResponse(req,response){
  if(req.method!=="GET")return response;
  const path=new URL(req.url).pathname;
  const body=await response.clone().json().catch(()=>null);
  if(!body||typeof body!=="object")return response;
  const normalized=normalizeProviderTruth(path,body);
  if(normalized===body)return response;
  return Response.json(normalized,{status:response.status,headers:{"cache-control":"no-store"}});
}
