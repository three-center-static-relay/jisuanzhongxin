const MAX_RESULT_BYTES=262144;
function token(env){const t=String(env.KAGGLE_API_TOKEN||"").trim();if(!t)throw Object.assign(new Error("KAGGLE_API_TOKEN_NOT_CONFIGURED"),{status:503});return t}
export async function readFixedResultFile(env,task){
  const owner=encodeURIComponent(String(task.user_name||"")),slug=encodeURIComponent(String(task.kernel_slug||""));
  if(!owner||!slug)throw Object.assign(new Error("KAGGLE_RESULT_IDENTITY_MISSING"),{status:502});
  const q=task.version_number?`?versionNumber=${encodeURIComponent(String(task.version_number))}`:"";
  const url=`https://www.kaggle.com/api/v1/kernels/output/download/${owner}/${slug}/three-center-result.json${q}`;
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
  try{
    const r=await fetch(url,{headers:{authorization:`Bearer ${token(env)}`,accept:"application/json,text/plain;q=0.9"},redirect:"follow",signal:c.signal});
    if(!r.ok)throw Object.assign(new Error(`KAGGLE_RESULT_HTTP_${r.status}`),{status:502});
    const raw=await r.text();
    if(new TextEncoder().encode(raw).length>MAX_RESULT_BYTES)throw Object.assign(new Error("KAGGLE_RESULT_TOO_LARGE"),{status:502});
    try{return JSON.parse(raw)}catch{throw Object.assign(new Error("KAGGLE_RESULT_BAD_JSON"),{status:502})}
  }catch(e){if(e?.name==="AbortError")throw Object.assign(new Error("KAGGLE_RESULT_TIMEOUT"),{status:504});throw e}finally{clearTimeout(timer)}
}