import guard,{CenterGate} from "./guard.js";
import {probeMcp} from "./kaggle-mcp.js";
export {CenterGate};
const PATH="/__diag/kaggle-live-41d820f5-4211-47dc-bf08-0b5316d602ae";
const EXPIRES=Date.parse("2026-08-15T04:00:00Z");
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(req.method==="POST"&&u.pathname===PATH){const b=await req.clone().json().catch(()=>({}));if(String(b.action||"")==="mcp_capability"){if(Date.now()>EXPIRES)return json({ok:false,error:"DIAG_EXPIRED"},410);try{const m=await probeMcp(env);return json({ok:m.ok===true,tools_count:m.tools_count,notebook_tools:m.notebook_tools,push_tool_present:m.push_tool_present===true,push_accepts_gpu:m.push_accepts_gpu===true,session_create_present:m.session_create_present===true,session_accepts_gpu:m.session_accepts_gpu===true,cancel_tool_present:m.cancel_tool_present===true,secret_echo:false})}catch(e){return json({ok:false,error_class:String(e?.message||"").startsWith("KAGGLE_MCP_")?"mcp":"other",http_status:Number(e?.status||0)||null,secret_echo:false},503)}}}return guard.fetch(req,env,ctx)}};