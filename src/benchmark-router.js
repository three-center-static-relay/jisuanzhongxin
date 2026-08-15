import {benchmarkMeta,benchmarkPack,benchmarkPacks,benchmarkPlan,evaluateBenchmarks,validateReferencePack,BENCHMARK_PACKS} from "./benchmark-library.js";
const MAX_BODY_BYTES=65536;
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const error=(code,message,status=400,details)=>json({ok:false,error:code,message,...(details?{details}:{})},status);
async function parse(req){const n=Number(req.headers.get("content-length")||0);if(n>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});const t=await req.text();if(new TextEncoder().encode(t).length>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});try{return t?JSON.parse(t):{}}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
export async function maybeHandleBenchmarks(req){const u=new URL(req.url);try{
  if(req.method==="GET"&&u.pathname==="/v1/benchmarks/meta")return json({ok:true,...benchmarkMeta()});
  if(req.method==="GET"&&u.pathname==="/v1/benchmarks/packs")return json({ok:true,count:Object.keys(BENCHMARK_PACKS).length,items:benchmarkPacks()});
  const m=u.pathname.match(/^\/v1\/benchmarks\/pack\/([a-z0-9_]+)$/);if(req.method==="GET"&&m){const p=benchmarkPack(m[1]);return p?json({ok:true,...p}):error("BENCHMARK_PACK_NOT_FOUND","Unknown benchmark pack",404,{allowed:Object.keys(BENCHMARK_PACKS)})}
  if(req.method==="POST"&&u.pathname==="/v1/benchmarks/plan")return json({ok:true,plan:benchmarkPlan(await parse(req))});
  if(req.method==="POST"&&u.pathname==="/v1/benchmarks/evaluate"){const out=evaluateBenchmarks(await parse(req));return json(out,out.state==="red"?422:200)}
  if(req.method==="POST"&&u.pathname==="/v1/benchmarks/validate-reference-pack")return json(validateReferencePack(await parse(req)));
  return null;
}catch(e){return error(e?.message||"BENCHMARK_ERROR","Benchmark guidance request failed",e?.status||400,e?.details)}}
