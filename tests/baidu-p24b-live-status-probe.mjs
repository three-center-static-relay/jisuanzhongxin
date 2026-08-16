import assert from "node:assert/strict";
const url="https://compute-worker.a15280020511.workers.dev/__diagnostic/baidu-v100-p24b-20260816-8f1a0df2c7674ea6b33798bd56f2cd42";
const c=new AbortController();const timer=setTimeout(()=>c.abort(),15000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  const b=await r.json();
  assert.equal(r.status,202);
  assert.equal(b.diagnostic,true);
  assert.equal(b.one_shot,true);
  assert.equal(b.task?.task_id,"baidu-circleci-live-20260816p24b");
  assert.ok(["bridge_dispatching","bridge_submitted","running","cancel_requested"].includes(String(b.task?.status||"")));
  assert.equal(b.task?.production_promoted,false);
  console.log(JSON.stringify({ok:true,suite:"baidu-p24b-live-status",state:"nonterminal",network:true}));
}finally{clearTimeout(timer)}
