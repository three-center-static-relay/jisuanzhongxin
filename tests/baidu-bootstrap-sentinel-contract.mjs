import assert from "node:assert/strict";
import fs from "node:fs";

const bridge=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");

assert.match(bridge,/BOOTSTRAP_SCHEMA = "baidu-bootstrap-sentinel-v1"/);
assert.match(bridge,/BOOTSTRAP_COMMAND = "sh \/home\/aistudio\/bootstrap\.sh"/);
assert.match(bridge,/output\/log\/bootstrap\.json/);
assert.match(bridge,/python3 \/home\/aistudio\/run\.py --task-id/);
assert.match(bridge,/_final_result_after_terminal/);
assert.match(bridge,/_fetch_bootstrap/);
assert.match(bridge,/BAIDU_JOB_RUNTIME_PROCESS_TERMINAL_FAILED/);
assert.match(bridge,/BAIDU_JOB_BOOTSTRAP_INTERRUPTED/);
assert.match(bridge,/BOOTSTRAP_NOT_AVAILABLE/);
assert.match(bridge,/dest\.stat\(\)\.st_size > 4096/);
assert.doesNotMatch(bridge,/python3[^\n]*>[^\n]*runtime\.log/);
assert.doesNotMatch(bridge,/printenv[^\n]*>/);
assert.doesNotMatch(bridge,/cat[^\n]*\/proc\/self\/environ/);
assert.doesNotMatch(bridge,/BAIDU_AISTUDIO_ACCESS_TOKEN[^\n]*>[^\n]*bootstrap/);
assert.doesNotMatch(bridge,/BRIDGE_TICKET[^\n]*>[^\n]*bootstrap/);
assert.match(bridge,/"--payment", "coupon"/);
assert.doesNotMatch(bridge,/"--payment", "acoin"/);
assert.match(bridge,/RUNTIME_CANDIDATE = "paddle2\.4_py3\.7"/);
console.log(JSON.stringify({ok:true,suite:"baidu-bootstrap-sentinel-contract",persisted_bootstrap:true,raw_runtime_log_persisted:false,terminal_final_result_retry:true,coupon_only:true,production_promotion:false}));
