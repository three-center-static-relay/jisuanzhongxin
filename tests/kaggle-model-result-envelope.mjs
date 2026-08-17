import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeModelRecipeResult} from "../src/guard.js";

const guard=fs.readFileSync(new URL("../src/guard.js",import.meta.url),"utf8");
const task={task_id:"acceptance-model-001",kind:"model-recipe",profile:"model",model_id:"commercial.robust_site_scenario",recipe:"commercial_spatial_signal_v2",method:"robust_site_scenario",gpu:false,machine_shape:"cpu"};
const direct={ok:true,task_id:task.task_id,model_id:task.model_id,recipe:task.recipe,method:task.method,network_used:false,arbitrary_code:false,evidence_kind:"inferred",sites:[{id:"a",robust_rank:1}]};
const normalized=normalizeModelRecipeResult(task,direct);
assert.equal(normalized.ok,true);
assert.equal(normalized.kind,"model-recipe");
assert.equal(normalized.task_id,task.task_id);
assert.equal(normalized.profile,"model");
assert.equal(normalized.model_id,task.model_id);
assert.equal(normalized.recipe,task.recipe);
assert.equal(normalized.method,task.method);
assert.equal(normalized.accelerator,"cpu");
assert.deepEqual(normalized.result,direct);

const canonical={ok:true,kind:"model-recipe",task_id:task.task_id,profile:"model",model_id:task.model_id,method:task.method,recipe:task.recipe,accelerator:"cpu",result:{ok:true}};
assert.equal(normalizeModelRecipeResult(task,canonical),canonical);

for(const bad of [
  {...direct,task_id:"wrong"},
  {...direct,model_id:"commercial.other"},
  {...direct,recipe:"wrong_recipe"},
  {...direct,method:"wrong_method"},
  {...direct,network_used:true},
  {...direct,network_used:undefined},
  {...direct,arbitrary_code:true},
  {...direct,arbitrary_code:undefined}
]) assert.equal(normalizeModelRecipeResult(task,bad),bad);
assert.equal(normalizeModelRecipeResult({...task,gpu:true},direct),direct);
assert.equal(normalizeModelRecipeResult({...task,machine_shape:"NvidiaTeslaT4"},direct),direct);
assert.equal(normalizeModelRecipeResult({...task,kind:"other"},direct),direct);

assert.match(guard,/result=normalizeModelRecipeResult\(task,out\.result\)/);
assert.match(guard,/result\.network_used===false/);
assert.match(guard,/result\.arbitrary_code===false/);
assert.match(guard,/task\.gpu===false/);
assert.match(guard,/machine_shape\|\|""\)\.toLowerCase\(\)==="cpu"/);
assert.match(guard,/result\.recipe\)\!==String\(task\.recipe\)/);
assert.match(guard,/result\.method\|\|""\)\!==String\(task\.method\|\|""\)/);

console.log(JSON.stringify({ok:true,suite:"kaggle-model-result-envelope",canonical_result_envelope:true,direct_recipe_strictly_canonicalized:true,network_false_required:true,arbitrary_code_false_required:true,cpu_task_attestation_required:true,identity_fields_required:true}));
