import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__acceptance/kaggle-robust-site-cpu-20260817-dd7c2c230882a36622dfce55a0b3f27f86d147f527aef68536c3d055b8da3434";
const response=await fetch(url,{method:"GET",headers:{accept:"application/json"}});
const body=await response.json().catch(()=>({}));
assert.equal(response.status,202);
assert.equal(body.ok,true);
assert.equal(body.task_id,"kaggle-recipe-live-20260817-robust-site-cpu");
assert.equal(body.model_id,"commercial.robust_site_scenario");
assert.equal(body.gpu,false);
assert.equal(body.network,false);
assert.equal(body.one_shot,true);
assert.equal(body.automatic_retry,false);
console.log(JSON.stringify({ok:true,suite:"diag-trigger-kaggle-robust-site-live",http_status:response.status,task_id:body.task_id,model_id:body.model_id,gpu:body.gpu,network:body.network,one_shot:body.one_shot,automatic_retry:body.automatic_retry,status:body.status||null,already_started:body.already_started===true}));
