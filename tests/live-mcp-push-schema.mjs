const endpoint="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-live-41d820f5-4211-47dc-bf08-0b5316d602ae";
const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({action:"mcp_push_schema"}),signal:c.signal});
  const b=await r.json().catch(()=>null);
  if(r.status!==200||b?.ok!==true) throw new Error(`MCP_PUSH_SCHEMA_FAILED_${r.status}`);
  if(b?.secret_echo!==false) throw new Error("SECRET_ECHO_POLICY_FAILED");
  if(b?.exact_kernel_push!==true) throw new Error("NOT_EXACT_KERNEL_PUSH");
  if(b?.required_supported!==true) throw new Error("MCP_PUSH_HAS_UNKNOWN_REQUIRED_FIELDS");
  if(!(b?.accepts_title&&b?.accepts_text&&b?.accepts_language&&b?.accepts_kernel_type&&b?.accepts_private)) throw new Error("MCP_PUSH_REQUIRED_CONTENT_FIELDS_MISSING");
  console.log(JSON.stringify({ok:true,phase:"kaggle-mcp-push-schema",exact_kernel_push:true,required_supported:true,content_fields:true,accepts_slug:Boolean(b.accepts_slug),property_count:b.property_count,required_count:b.required_count}));
} finally { clearTimeout(t); }
