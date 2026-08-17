import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/kaggle-robust-site-cpu-result-20260817-969edb7ed3d5c36fe2dd49c6cd5cdd37a5a93c0ef2162dcb08922954c6c965d4";
const response=await fetch(url,{method:"GET",headers:{accept:"application/json"}});
const body=await response.json().catch(()=>({}));
assert.notEqual(response.status,404);
assert.ok([200,202,502,503].includes(response.status));
assert.equal(body.diagnostic,true);
assert.equal(body.task_id,"kaggle-recipe-live-20260817-robust-site-cpu");
assert.equal(body.model_id,"commercial.robust_site_scenario");
assert.equal(body.gpu,false);
assert.equal(body.machine_shape,"cpu");
assert.equal(body.network,false);
assert.equal(body.one_shot,true);
assert.equal(body.automatic_retry,false);
console.log(JSON.stringify({ok:true,suite:"diag-status-kaggle-robust-site-live",http_status:response.status,task_id:body.task_id,model_id:body.model_id,status:body.status||null,result_digest_present:/^[a-f0-9]{64}$/.test(String(body.result_digest||"")),verification_ok:body.verification?.ok===true,output_source:body.output_retrieval?.source||null,temporary_kernel_deleted:body.temporary_kernel_deleted===true,gpu:body.gpu,machine_shape:body.machine_shape,network:body.network,one_shot:body.one_shot,automatic_retry:body.automatic_retry}));
