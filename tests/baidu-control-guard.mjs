import assert from "node:assert/strict";
import fs from "node:fs";

const router=fs.readFileSync(new URL("../src/baidu-circleci-router.js",import.meta.url),"utf8");

assert.match(router,/function internalControl\(req\)\{return new URL\(req\.url\)\.hostname==="compute\.internal"\}/);
assert.match(router,/Baidu task status and cancel controls are service-binding internal only/);
assert.match(router,/async function status\(req,env\).*if\(!internalControl\(req\)\)return denyExternalControl\(\)/s);
assert.match(router,/async function cancel\(req,env\).*if\(!internalControl\(req\)\)return denyExternalControl\(\)/s);
assert.match(router,/async function start\(req,env\).*hostname!=="compute\.internal"/s);
assert.match(router,/function accepted\(env\).*m\.configured&&m\.e2e_verified/s);
assert.match(router,/ticketAuthorized\(req,t\)/);
assert.match(router,/x-three-center-bridge-ticket/);
assert.match(router,/\/v1\/providers\/baidu\/bridge\/callback/);

console.log(JSON.stringify({ok:true,suite:"baidu-control-guard",start_internal_only:true,status_internal_only:true,cancel_internal_only:true,bridge_ticket_callbacks_preserved:true,gpu_started:false}));
