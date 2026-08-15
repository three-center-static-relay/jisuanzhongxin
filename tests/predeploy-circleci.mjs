import assert from "node:assert/strict";
import fs from "node:fs";
import {baiduCircleCIMeta,digestBridgeTicket,newBridgeTicket,normalizeBaiduInput,triggerBaiduBridge} from "../src/baidu-circleci.js";

const missing=baiduCircleCIMeta({});
assert.equal(missing.configured,false);
assert.equal(missing.e2e_verified,false);
assert.equal(missing.route_eligible,false);
assert.equal(missing.baidu_payment,"coupon");
assert.equal(missing.baidu_device,"v100");
assert.equal(missing.baidu_gpus,1);
assert.equal(missing.arbitrary_code,false);
assert.equal(missing.arbitrary_shell,false);
assert.equal(missing.static_shared_secret_required,false);
assert.equal(missing.ephemeral_ticket,true);

const ready=baiduCircleCIMeta({CIRCLECI_API_TOKEN:"x",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"def",BAIDU_CIRCLECI_E2E_VERIFIED:"true"});
assert.equal(ready.configured,true);
assert.equal(ready.route_eligible,true);
assert.deepEqual(normalizeBaiduInput({matrix_size:99999,rounds:99,seed:-1}),{matrix_size:2048,rounds:5,seed:1});

const ticket=newBridgeTicket();
assert.match(ticket,/^[A-Za-z0-9_-]{32,128}$/);
const digest=await digestBridgeTicket(ticket);
assert.match(digest,/^[a-f0-9]{64}$/);

const config=fs.readFileSync(new URL("../.circleci/config.yml",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge.py",import.meta.url),"utf8");
const job=fs.readFileSync(new URL("../bridge/baidu/job/run.py",import.meta.url),"utf8");
assert.match(config,/bridge_dispatch:/);
assert.match(config,/default: false/);
assert.match(config,/bridge_ticket:/);
assert.match(config,/BRIDGE_TICKET:/);
assert.match(config,/aistudio-sdk==0\.3\.8/);
assert.match(bridge,/x-three-center-bridge-ticket/);
assert.doesNotMatch(bridge,/BAIDU_BRIDGE_SHARED_SECRET/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/--payment.*acoin/);
assert.match(bridge,/shell=False/);
assert.match(job,/\/home\/aistudio\/output\/three-center-result\.json/);
assert.match(job,/paddle\.set_device\("gpu:0"\)/);

const oldFetch=globalThis.fetch;
try{
  let seen={};
  globalThis.fetch=async(url,init)=>{seen={url:String(url),headers:init.headers,body:JSON.parse(init.body)};return new Response(JSON.stringify({id:"pipe-1",number:7,state:"created"}),{status:201,headers:{"content-type":"application/json"}})};
  const out=await triggerBaiduBridge({CIRCLECI_API_TOKEN:"circle-token",CIRCLECI_PROJECT_SLUG:"circleci/org/project",CIRCLECI_PIPELINE_DEFINITION_ID:"definition-1",CIRCLECI_CONFIG_BRANCH:"main"},{op:"SUBMIT",task_id:"task-001",bridge_ticket:ticket});
  assert.equal(out.ok,true);
  assert.match(seen.url,/circleci\.com\/api\/v2\/project\/circleci\/org\/project\/pipeline\/run$/);
  assert.equal(seen.headers["Circle-Token"],"circle-token");
  assert.equal(seen.body.definition_id,"definition-1");
  assert.equal(seen.body.parameters.bridge_dispatch,true);
  assert.equal(seen.body.parameters.bridge_op,"SUBMIT");
  assert.equal(seen.body.parameters.task_id,"task-001");
  assert.equal(seen.body.parameters.bridge_ticket,ticket);
  assert.equal(JSON.stringify(seen).includes("BAIDU_BRIDGE_SHARED_SECRET"),false);
}finally{globalThis.fetch=oldFetch}

console.log(JSON.stringify({ok:true,suite:"predeploy-circleci",fail_closed:true,coupon_only:true,fixed_v100:true,ephemeral_ticket:true,static_shared_secret:false,arbitrary_code:false,network:false}));
