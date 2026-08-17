import {planOpenEOHandoff,validateOpenEOHandoff} from "./openeo.js";
const MAX_BODY_BYTES=32768;
const HANDOFF_VERSION="copernicus-openeo-handoff-v1-20260817";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const stamp=body=>({...body,handoff_version:HANDOFF_VERSION});
function cleanError(e){return stamp({ok:false,error:String(e?.message||"OPENEO_HANDOFF_FAILED"),message:"Copernicus Intelligence-to-openEO handoff failed",details:e?.details&&typeof e.details==="object"?e.details:undefined,execution_started:false,credits_spent:false,secret_echo:false})}
async function body(req){const n=Number(req.headers.get("content-length")||0);if(n>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});const raw=await req.text();if(new TextEncoder().encode(raw).length>MAX_BODY_BYTES)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});try{return raw?JSON.parse(raw):{}}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
export async function maybeHandleOpenEOHandoff(req,env){
  const u=new URL(req.url);
  if(req.method!=="POST"||!["/v1/providers/openeo/handoff/plan","/v1/providers/openeo/handoff/validate"].includes(u.pathname))return null;
  try{
    const input=await body(req);
    if(u.pathname.endsWith("/plan"))return json(stamp(planOpenEOHandoff(input)));
    const out=await validateOpenEOHandoff(env,input);
    return json(stamp(out),out.validation_ok===true?200:422);
  }catch(e){return json(cleanError(e),Number(e?.status)||500)}
}
