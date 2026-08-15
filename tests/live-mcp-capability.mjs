const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-live-41d820f5-4211-47dc-bf08-0b5316d602ae";
const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"mcp_capability"}),signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true) throw new Error(`MCP_CAPABILITY_FAILED_${r.status}`);
  if(!(Number(b.tools_count)>0&&Number(b.notebook_tools)>0)) throw new Error("MCP_NOTEBOOK_TOOLS_MISSING");
  if(b.secret_echo!==false) throw new Error("SECRET_ECHO_POLICY_FAILED");
  if(b.push_tool_present!==true) throw new Error("MCP_PUSH_TOOL_MISSING");
  console.log(JSON.stringify({ok:true,phase:"kaggle-mcp-capability",tools_count:b.tools_count,notebook_tools:b.notebook_tools,push_tool_present:b.push_tool_present,session_create_present:b.session_create_present,push_accepts_gpu:b.push_accepts_gpu,session_accepts_gpu:b.session_accepts_gpu,cancel_tool_present:b.cancel_tool_present}));
} finally { clearTimeout(t); }
