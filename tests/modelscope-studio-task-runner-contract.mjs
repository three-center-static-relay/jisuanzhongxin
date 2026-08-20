import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeModelScopeLiteTask,modelScopeStudioTaskMeta} from "../src/modelscope-studio-task.js";
import {productionStatus} from "../src/modelscope-studio-lite-production-status.js";

const id="mscpu_contract_123456";
let r=normalizeModelScopeLiteTask({op:"sum",values:[1,2,3,4,5]},id);
assert.equal(r.ok,true);assert.equal(r.task.task_id,id);assert.deepEqual(r.task.values,[1,2,3,4,5]);
r=normalizeModelScopeLiteTask({op:"stats",values:[1,2,3]},id);assert.equal(r.ok,true);
r=normalizeModelScopeLiteTask({op:"dot",a:[1,2],b:[3,4]},id);assert.equal(r.ok,true);
r=normalizeModelScopeLiteTask({op:"matmul",a:[[1,2],[3,4]],b:[[5],[6]]},id);assert.equal(r.ok,true);
r=normalizeModelScopeLiteTask({op:"linear_regression",x:[1,2,3],y:[2,4,6]},id);assert.equal(r.ok,true);
r=normalizeModelScopeLiteTask({op:"monte_carlo_pi",samples:1000,seed:7},id);assert.equal(r.ok,true);
assert.equal(normalizeModelScopeLiteTask({op:"eval",values:[1]},id).ok,false);
assert.equal(normalizeModelScopeLiteTask({op:"sum",values:Array(2001).fill(1)},id).ok,false);
assert.equal(normalizeModelScopeLiteTask({op:"dot",a:[1],b:[1,2]},id).ok,false);
assert.equal(normalizeModelScopeLiteTask({op:"matmul",a:[[1,2]],b:[[1,2]]},id).ok,false);
assert.equal(normalizeModelScopeLiteTask({op:"monte_carlo_pi",samples:999,seed:1},id).ok,false);

const meta=modelScopeStudioTaskMeta();
assert.deepEqual(meta.allowed_ops,["sum","stats","dot","matmul","linear_regression","monte_carlo_pi"]);
assert.equal(meta.arbitrary_code,false);assert.equal(meta.network_task_input,false);assert.equal(meta.free_only,true);assert.equal(meta.paid_fallback,false);assert.equal(meta.task_transport,"ephemeral-studio-secret");assert.equal(meta.task_value_exposed,false);
const promoted=productionStatus({configured:true,authenticated:true,studio_found:true,catalog_verified:true,hardware:{name:"platform/2v-cpu-16g-mem",resource_type:"free",has_stock:true}});
assert.equal(promoted.ok,true);assert.equal(promoted.route_eligible,true);assert.equal(promoted.business_task_e2e_attested,true);assert.equal(promoted.generic_business_task_adapter,true);assert.equal(promoted.automatic_global_routing,true);assert.equal(promoted.explicit_selection_only,false);assert.equal(promoted.business_task_receipt.op,"sum");assert.equal(promoted.business_task_receipt.result,15);assert.equal(promoted.business_task_receipt.task_secret_cleared,true);assert.equal(promoted.business_task_receipt.gate_released,true);assert.equal(promoted.free_only,true);assert.equal(promoted.paid_fallback,false);
const noStock=productionStatus({configured:true,authenticated:true,studio_found:true,catalog_verified:true,hardware:{name:"platform/2v-cpu-16g-mem",resource_type:"free",has_stock:false}});assert.equal(noStock.route_eligible,false);assert.equal(noStock.automatic_global_routing,false);

const task=fs.readFileSync(new URL("../src/modelscope-studio-task.js",import.meta.url),"utf8");
const lite=fs.readFileSync(new URL("../src/modelscope-studio-lite.js",import.meta.url),"utf8");
const workflow=fs.readFileSync(new URL("../src/modelscope-studio-workflow.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const prod=fs.readFileSync(new URL("../src/modelscope-studio-lite-production-status.js",import.meta.url),"utf8");

for(const literal of ['TASK_VAR="THREE_CENTER_TASK_JSON"','TASK_REVISION="studio-lite-task-v1-20260820"','TASK_MARKER="THREE_CENTER_MODELSCOPE_TASK:"','/secrets','exists?"PUT":"POST"','"DELETE"','task_value_exposed:false','max_task_bytes:MAX_TASK_BYTES'])assert.ok(task.includes(literal),`Missing task transport contract: ${literal}`);
assert.ok(!task.includes('/variables'),"Task payload must not use plaintext Studio variables");assert.ok(!task.includes('eval('),"Task adapter must not evaluate arbitrary code");assert.ok(!task.includes('new Function'),"Task adapter must not compile arbitrary code");
for(const literal of ['raw_task=os.environ.get(TASK_VAR',"op=='sum'","op=='stats'","op=='dot'","op=='matmul'","op=='linear_regression'","op=='monte_carlo_pi'",'print(TASK_MARKER+',"ValueError('UNSUPPORTED_TASK_OP')"])assert.ok(lite.includes(literal),`Missing fixed Studio task implementation: ${literal}`);
assert.ok(!lite.includes('eval(raw_task'),"Studio task runner must not eval task payload");assert.ok(!lite.includes('exec(raw_task'),"Studio task runner must not exec task payload");
for(const literal of ['event?.payload?.task_id','event?.payload?.op','workflow_payload_contains_task_values:false','clear Studio Lite task secret','stop Studio Lite after task','release ModelScope compute gate','getModelScopeStudioLiteTaskStatus','polling_rounds_max:8','paid_fallback:false'])assert.ok(workflow.includes(literal),`Missing task Workflow contract: ${literal}`);
assert.ok(!workflow.includes('event?.payload?.task,'),"Workflow payload must not persist full task values");assert.ok(!workflow.includes('setModelScopeStudioLiteTask'),"Workflow must not receive raw task values for secret injection");
for(const literal of ['/v1/admin/modelscope/studio-lite/compute','url.hostname!=="compute.internal"','kind:"modelscope-free-cpu"','lease_seconds:TASK_LEASE_SECONDS','setModelScopeStudioLiteTask(env,normalized.task)','params:{mode:"task",task_id:taskId,op:normalized.task.op','task_values_persisted:false','workflow_payload_contains_task_values:false','clearModelScopeStudioLiteTask(env)','/release'])assert.ok(entry.includes(literal),`Missing internal task control contract: ${literal}`);
assert.ok(!entry.includes('params:{mode:"task",task:normalized.task'),"Workflow params must not contain task values");assert.ok(!entry.includes('maybeHandleModelScopeTaskSumDiagnostic'),"Temporary public task diagnostic must be removed after acceptance");
for(const literal of ['production_acceptance:"2026-08-20-business-task-sum-e2e-pass"','business_task_e2e_attested:true','generic_business_task_adapter:true','route_scope:"free-light-cpu-bounded-numerical-task"','task_transport:"ephemeral-studio-secret"','workflow_payload_contains_task_values:false','arbitrary_code:false','paid_fallback:false'])assert.ok(prod.includes(literal),`Missing production promotion contract: ${literal}`);

console.log(JSON.stringify({ok:true,suite:"modelscope-studio-task-runner-contract",ops:meta.allowed_ops,internal_only:true,single_active_gate:true,ephemeral_secret:true,workflow_payload_values:false,arbitrary_code:false,business_e2e_attested:true,automatic_when_free_stock:true,public_diagnostic_removed:true,free_only:true,paid_fallback:false}));
