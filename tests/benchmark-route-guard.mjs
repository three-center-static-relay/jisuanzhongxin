import assert from "node:assert/strict";
import fs from "node:fs";

const router=fs.readFileSync(new URL("../src/benchmark-router.js",import.meta.url),"utf8");

assert.match(router,/const internalOnly=u=>u\.hostname==="compute\.internal"/);
assert.match(router,/Benchmark computational routes are service-binding internal only/);
for(const path of ["plan","evaluate","validate-reference-pack"]){
  assert.ok(router.includes(`u.pathname===\"/v1/benchmarks/${path}\"`));
}
assert.match(router,/if\(!internalOnly\(u\)\)return deny\(\)/);
assert.match(router,/req\.method==="GET"&&u\.pathname==="\/v1\/benchmarks\/meta"/);
assert.match(router,/req\.method==="GET"&&u\.pathname==="\/v1\/benchmarks\/packs"/);
assert.match(router,/MAX_BODY_BYTES=65536/);

console.log(JSON.stringify({ok:true,suite:"benchmark-route-guard",public_read_only:true,computational_post_internal_only:true,max_body_bytes:65536,external_compute_started:false}));
