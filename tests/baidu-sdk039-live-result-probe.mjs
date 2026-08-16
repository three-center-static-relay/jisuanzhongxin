import assert from "node:assert/strict";

const url="https://compute-worker.a15280020511.workers.dev/__selftest/baidu-sdk039-direct-20260816-f56561f423a550b1e0fbf25189ec7f12f5796e19e999e2c46527795b5b718ba8";
const c=new AbortController();
const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.ok([200,202].includes(r.status));
  assert.equal(b.ok,true);
  if(b.already_started===true){
    assert.ok(b.task&&typeof b.task==="object");
    assert.equal(b.task.task_id,"baidu-sdk039-control-plane-20260816a");
    assert.equal(b.task.sdk_candidate,"0.3.9");
    assert.equal(b.task.gpu,false);
    assert.equal(b.task.compute_credit_used,false);
    assert.equal(b.task.production_promoted,false);
  }else{
    assert.equal(b.task_id,"baidu-sdk039-control-plane-20260816a");
    assert.equal(b.status,"bridge_submitted");
    assert.equal(b.sdk_version,"0.3.9");
    assert.equal(b.gpu,false);
    assert.equal(b.compute_credit_used,false);
    assert.equal(b.one_shot,true);
  }
  console.log(JSON.stringify({ok:true,suite:"baidu-sdk039-direct-trigger",circleci_dispatched:true,sdk_version:"0.3.9",gpu:false,compute_credit_used:false,one_shot:true}));
}finally{clearTimeout(timer)}
