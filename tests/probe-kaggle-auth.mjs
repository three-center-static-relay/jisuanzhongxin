const url="https://compute-worker.a15280020511.workers.dev/__diag/kaggle-auth-7f3f3abf-5b20-4f98-a62f-0ad9e61f4218";
const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);
try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:c.signal});
  if(!r.ok)throw new Error(`DIAG_HTTP_${r.status}`);
  const b=await r.json();
  if(b?.secret_echo!==false)throw new Error("SECRET_ECHO_POLICY_FAILED");
  if(b?.rest_authenticated!==true)throw new Error(`KAGGLE_REST_AUTH_FAILED_${b?.rest_status||0}`);
  console.log(JSON.stringify({ok:true,rest_authenticated:true,rest_status:b.rest_status,mcp_status:b.mcp_status,mcp_bearer_authenticated:Boolean(b.mcp_bearer_authenticated),mcp_oauth_challenge:Boolean(b.mcp_oauth_challenge)}));
}finally{clearTimeout(t)}