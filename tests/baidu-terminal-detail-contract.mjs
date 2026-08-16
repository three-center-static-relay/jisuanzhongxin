import assert from "node:assert/strict";
import fs from "node:fs";

const check=fs.readFileSync(new URL("../bridge/baidu/bridge_entry4.py",import.meta.url),"utf8");
const submit=fs.readFileSync(new URL("../bridge/baidu/bridge_entry9.py",import.meta.url),"utf8");
const router=fs.readFileSync(new URL("../src/baidu-circleci-router.js",import.meta.url),"utf8");

assert.match(check,/SAFE_DIAGNOSTIC_KEYS/);
assert.match(check,/_safe_pipeline_diagnostic/);
assert.match(check,/_classify_terminal_diagnostic/);
assert.match(check,/BAIDU_JOB_RUNTIME_ENV_FAILED/);
assert.match(check,/BAIDU_JOB_COMMAND_FAILED/);
assert.match(check,/BAIDU_JOB_RESOURCE_UNAVAILABLE/);
assert.match(check,/upstream_diagnostic/);
assert.doesNotMatch(check,/SAFE_DIAGNOSTIC_KEYS[\s\S]*?pipelineId[",]/);
assert.doesNotMatch(check,/SAFE_DIAGNOSTIC_KEYS[\s\S]*?pipelineName[",]/);
assert.doesNotMatch(check,/SAFE_DIAGNOSTIC_KEYS[\s\S]*?secretAccessKey/);
assert.match(submit,/terminal_failure_class/);
assert.match(submit,/upstream_diagnostic/);
assert.match(router,/SAFE_UPSTREAM_KEYS/);
assert.match(router,/safeUpstreamDiagnostic/);
assert.match(router,/upstream_diagnostic:t\.upstream_diagnostic\|\|null/);
assert.doesNotMatch(router,/SAFE_UPSTREAM_KEYS[\s\S]*?pipelineId[",]/);
assert.doesNotMatch(router,/SAFE_UPSTREAM_KEYS[\s\S]*?pipelineName[",]/);
assert.doesNotMatch(router,/SAFE_UPSTREAM_KEYS[\s\S]*?secretAccessKey/);
assert.match(router,/\[REDACTED\]/);
console.log(JSON.stringify({ok:true,suite:"baidu-terminal-detail-contract",allowlisted:true,redacted:true,pipeline_identity_exposed:false,secret_fields_exposed:false,terminal_detail_classification:true}));
