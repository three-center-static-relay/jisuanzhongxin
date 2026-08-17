import {MODELSCOPE_RUNTIME_REQUIREMENTS,evaluateModelScopeRuntime,probeModelScope} from "./modelscope-compute.js";

const STATE_ID="modelscope-runtime-monitor";
const now=()=>new Date().toISOString();

function gate(env){return env.CENTER_GATE?.get?.(env.CENTER_GATE.idFromName("global"))||null}
async function gateCall(env,path,method="GET",body){
  const g=gate(env);if(!g)return{ok:false,error:"CENTER_GATE_UNAVAILABLE"};
  const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);
  const r=await g.fetch(new Request(`https://gate.internal${path}`,init));
  return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))};
}
async function load(env){return(await gateCall(env,`/task/${STATE_ID}`)).task||null}
async function save(env,patch){return gateCall(env,`/task/${STATE_ID}`,"POST",{kind:"modelscope-runtime-monitor",...patch})}

function classify(probe,runtime){
  const alerts=[...(probe?.alerts||[]),...(runtime?.alerts||[])];
  const unique=[...new Set(alerts)];
  const hard=unique.filter(x=>MODELSCOPE_RUNTIME_REQUIREMENTS.alert_on.includes(x));
  let state="CANDIDATE",reason="RUNTIME_E2E_REQUIRED";
  if(probe?.user_action_required===true){state="ALERT";reason=unique[0]||"USER_ACTION_REQUIRED"}
  else if(probe?.free_hardware_verified!==true){state="WARNING";reason="FREE_CPU_BASELINE_UNVERIFIED"}
  else if(runtime?.verified===true&&runtime?.compatible===false){state="ALERT";reason="RUNTIME_BASELINE_NOT_MET"}
  else if(runtime?.verified===true&&runtime?.compatible===true){state="VERIFIED";reason="FREE_RUNTIME_BASELINE_COMPATIBLE"}
  return {state,reason,alerts:unique,hard_alerts:hard,user_action_required:hard.length>0||probe?.user_action_required===true};
}

export async function recordModelScopeRuntimeAttestation(env,attestation={}){
  const previous=await load(env);
  const runtime=evaluateModelScopeRuntime(attestation);
  const probe=previous?.probe||await probeModelScope(env);
  const status=classify(probe,runtime);
  const record={probe,runtime,status,requirements:MODELSCOPE_RUNTIME_REQUIREMENTS,last_runtime_attested_at:now(),last_checked_at:now()};
  await save(env,record);
  return {ok:true,...record};
}

export async function runModelScopeRuntimeSweep(env){
  const previous=await load(env);
  const probe=await probeModelScope(env);
  const runtime=previous?.runtime?.verified===true?previous.runtime:evaluateModelScopeRuntime({});
  const status=classify(probe,runtime);
  const record={probe,runtime,status,requirements:MODELSCOPE_RUNTIME_REQUIREMENTS,last_runtime_attested_at:previous?.last_runtime_attested_at||null,last_checked_at:now()};
  await save(env,record);
  return {ok:true,...record};
}

export async function getModelScopeRuntimeSnapshot(env){
  const record=await load(env);
  if(record)return {ok:true,provider:"modelscope",...record};
  return {ok:true,provider:"modelscope",status:{state:"CANDIDATE",reason:"AWAITING_FIRST_DAILY_SWEEP",alerts:[],hard_alerts:[],user_action_required:false},requirements:MODELSCOPE_RUNTIME_REQUIREMENTS,last_checked_at:null,last_runtime_attested_at:null};
}
