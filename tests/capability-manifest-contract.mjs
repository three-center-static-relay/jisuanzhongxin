import assert from "node:assert/strict";
import {CAPABILITY_ABI_VERSION,computeCapabilityManifest} from "../src/capability-manifest.js";

const manifest=computeCapabilityManifest({backends:{kaggle:{route_eligible:true},google_earth_engine:{route_eligible:true},copernicus_openeo:{route_eligible:false},wolfram_alpha:{route_eligible:false}}});
assert.equal(manifest.abi_version,CAPABILITY_ABI_VERSION);
assert.equal(manifest.center,"compute");
assert.ok(manifest.capabilities.length>=6);
const ids=new Set();
for(const capability of manifest.capabilities){
  assert.match(capability.id,/^[a-z0-9][a-z0-9._:-]+$/);
  assert.ok(capability.operations.length>0);
  assert.equal(capability.write_scope,"none");
  assert.equal(capability.trust.level,"T0");
  assert.ok(["unverified","quarantined"].includes(capability.trust.status));
  assert.ok(["configured-unverified","unconfigured"].includes(capability.verification.status));
  assert.equal(capability.verification.receipt_digest,null);
  assert.equal(capability.last_verified,null);
  assert.equal(capability.cost.unit_cost,null);
  assert.equal(capability.cost.estimate_status,"unknown");
  assert.equal(ids.has(capability.id),false);ids.add(capability.id);
}
assert.equal(manifest.capabilities.find(x=>x.id==="compute.cpu").health.status,"configured-unverified");
assert.equal(manifest.backend_summary.runtime_verified,0);
assert.doesNotMatch(JSON.stringify(manifest),/token|password|authorization|cookie|api.?key/i);
console.log(JSON.stringify({ok:true,suite:"capability-manifest-contract",center:"compute",capability_count:manifest.capabilities.length}));
