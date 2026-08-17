import assert from "node:assert/strict";
import {createTestHarness} from "wrangler";

const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
const INTERNAL="https://compute.internal";
async function post(path,body,origin=INTERNAL){const r=await server.fetch(`${origin}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
let exitCode=0;
try{
  await server.listen();
  await server.reset();
  const h=await server.fetch(`${INTERNAL}/health`);assert.equal(h.status,200);
  const external=await post("/v1/run",{task_id:"external-denied",profile:"core"},"https://public.example");assert.equal(external.status,403);assert.equal(external.body?.error,"POLICY_DENIED");
  const bad=await post("/v1/run",{task_id:"bad-profile",profile:"arbitrary-shell"});assert.equal(bad.status,400);assert.equal(bad.body?.error,"INVALID_REQUEST");
  const big={task_id:"huge",profile:"core",input:{padding:"x".repeat(70000)}};const br=await server.fetch(`${INTERNAL}/v1/run`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(big)});assert.equal(br.status,413);
  const health=await Promise.all(Array.from({length:64},()=>server.fetch(`${INTERNAL}/health`)));assert.equal(health.filter(r=>r.status===200).length,64);
  console.log(JSON.stringify({ok:true,suite:"compute-stress-stage-a",tests:["harness","internal-health","external-execution-deny","profile-deny","body-limit","health-burst-64"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await server.close()}catch{}
process.exit(exitCode);
