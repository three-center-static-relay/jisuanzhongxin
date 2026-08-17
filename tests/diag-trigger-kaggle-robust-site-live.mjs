import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/kaggle-robust-site-cpu-result-20260817-969edb7ed3d5c36fe2dd49c6cd5cdd37a5a93c0ef2162dcb08922954c6c965d4";
const response=await fetch(url,{method:"GET",headers:{accept:"application/json"}});
const body=await response.json().catch(()=>({}));
assert.equal(response.status,404);
assert.equal(body.diagnostic,true);
assert.equal(body.task_id,"kaggle-recipe-live-20260817-robust-site-cpu");
assert.equal(body.model_id,"commercial.robust_site_scenario");
assert.equal(body.status,null);
assert.equal(body.result_digest,null);
assert.equal(body.gpu,false);
assert.equal(body.machine_shape,"cpu");
assert.equal(body.network,false);
assert.equal(body.one_shot,true);
assert.equal(body.automatic_retry,false);
console.log(JSON.stringify({ok:true,suite:"diag-kaggle-task-absent",http_status:404,task_id:body.task_id,model_id:body.model_id,task_created:false,gpu:false,network:false}));
