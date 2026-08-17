import base,{CenterGate} from "./production-entry.js";
export {CenterGate};

const TASK_ID="kaggle-recipe-live-20260817-robust-site-cpu";
const MODEL_ID="commercial.robust_site_scenario";
const ACCEPTANCE_PATH="/__acceptance/kaggle-robust-site-cpu-20260817-dd7c2c230882a36622dfce55a0b3f27f86d147f527aef68536c3d055b8da3434";
const STATUS_PATH="/__diagnostic/kaggle-robust-site-cpu-result-20260817-969edb7ed3d5c36fe2dd49c6cd5cdd37a5a93c0ef2162dcb08922954c6c965d4";
const ACCEPTANCE_EXPIRES_AT=Date.parse("2026-08-17T06:00:00Z");
const DIAGNOSTIC_EXPIRES_AT=Date.parse("2026-08-17T07:00:00Z");
const RECEIPT_DIGEST="99006fa4a9b5e0927cd5b2f2c8b8e7601a140ee68e954d02bfb0b1dd08b0029b";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

const INPUT={
  seed:20260817,
  draws:500,
  evidence_bundle:{
    contract_version:"commercial-spatial-evidence-v1-20260817",
    source_receipts:[{source:"synthetic-acceptance-fixture",digest_sha256:RECEIPT_DIGEST}],
    records:[{record_id:"acceptance-aggregate-001",evidence_kind:"observed",observed:true,test_fixture:true,metric:"aggregate-demand-anchor",value:1,quality:{source_type:"synthetic-acceptance-fixture"}}]
  },
  sites:[
    {id:"site-a",metrics:{demand:{value:72,low:66,high:78,weight:0.6},access:{value:61,low:56,high:66,weight:0.4}}},
    {id:"site-b",metrics:{demand:{value:64,low:58,high:70,weight:0.6},access:{value:76,low:70,high:82,weight:0.4}}}
  ]
};

async function internalPost(path,env,ctx,body){
  const r=await base.fetch(new Request(`https://compute.internal${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),env,ctx);
  return{status:r.status,body:await r.json().catch(()=>({ok:false,error:"BAD_INTERNAL_JSON"}))};
}
function safeStatus(r){const b=r.body||{};return{ok:b.ok===true,diagnostic:true,task_id:TASK_ID,model_id:MODEL_ID,status:b.status||null,result_digest:b.result_digest||null,log_digest:b.log_digest||null,verification:b.verification||null,output_retrieval:b.output_retrieval||null,temporary_kernel_deleted:b.temporary_kernel_deleted===true,finished_at:b.finished_at||null,gpu:false,machine_shape:"cpu",network:false,one_shot:true,automatic_retry:false}}
async function start(env,ctx){
  const r=await internalPost("/v1/models/run",env,ctx,{task_id:TASK_ID,model_id:MODEL_ID,timeout_seconds:300,input:INPUT});
  if(r.status===202&&r.body?.ok===true)return json({ok:true,task_id:TASK_ID,status:r.body.status||"running",model_id:MODEL_ID,recipe:r.body.recipe||null,executor:r.body.executor||null,machine_shape:r.body.machine_shape||"cpu",gpu:false,network:false,one_shot:true,automatic_retry:false},202);
  if(r.status===409&&r.body?.error==="DUPLICATE_TASK")return json({ok:true,already_started:true,task_id:TASK_ID,status:r.body?.details?.status||"unknown",model_id:MODEL_ID,gpu:false,network:false,one_shot:true,automatic_retry:false},202);
  return json({ok:false,error:r.body?.error||"KAGGLE_RECIPE_DISPATCH_FAILED",task_id:TASK_ID,http_status:r.status,gpu:false,one_shot:true},r.status||502);
}
export {TASK_ID,MODEL_ID,ACCEPTANCE_PATH,STATUS_PATH};
export default{async fetch(req,env,ctx){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname===ACCEPTANCE_PATH){
    if(Date.now()>ACCEPTANCE_EXPIRES_AT)return json({ok:false,error:"ACCEPTANCE_ROUTE_EXPIRED"},410);
    return start(env,ctx);
  }
  if(req.method==="GET"&&u.pathname===STATUS_PATH){
    if(Date.now()>DIAGNOSTIC_EXPIRES_AT)return json({ok:false,error:"DIAGNOSTIC_EXPIRED",diagnostic:true},410);
    const r=await internalPost("/v1/status",env,ctx,{task_id:TASK_ID});
    return json(safeStatus(r),r.status);
  }
  return base.fetch(req,env,ctx);
}};
