import {mkdir,writeFile,rm} from "node:fs/promises";
import {dirname,join} from "node:path";
import {spawnSync} from "node:child_process";
const SHA="4eabcfd47eab176e62347cb0551f43ad404a0515";
const BASE=`https://raw.githubusercontent.com/three-center-static-relay/qingbaozhongxin/${SHA}`;
const files=["src/guard.js","src/index.js","src/catalog.js","src/catalog-base.js","src/adapters.js","src/adapters-core.js","src/adapters-extra.js","src/adapters-extra2.js","src/adapters-extra3.js","src/adapters-extra4.js","wrangler.test.jsonc","tests/stress.mjs"];
const root=join(process.cwd(),".tmp-intelligence-stress");
const hard=setTimeout(()=>{console.error("CROSS_INTELLIGENCE_WATCHDOG_TIMEOUT");process.exit(124)},70000);
try{
  await rm(root,{recursive:true,force:true});
  for(const file of files){const r=await fetch(`${BASE}/${file}`,{headers:{accept:"text/plain"}});if(!r.ok)throw new Error(`FETCH_FAILED:${file}:${r.status}`);const p=join(root,file);await mkdir(dirname(p),{recursive:true});await writeFile(p,await r.text(),"utf8")}
  const out=spawnSync(process.execPath,["tests/stress.mjs"],{cwd:root,stdio:"inherit",timeout:55000,env:{...process.env}});
  if(out.error)throw out.error;if(out.status!==0)throw new Error(`INTELLIGENCE_STRESS_EXIT:${out.status}`);
  console.log(JSON.stringify({ok:true,suite:"cross-intelligence-stress",source_commit:SHA,runner:"compute-worker-build"}));
}finally{await rm(root,{recursive:true,force:true}).catch(()=>{});clearTimeout(hard)}
