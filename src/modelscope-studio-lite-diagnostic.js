const OPENAPI="https://modelscope.cn/openapi/v1";
const REPO_NAME="three-center-cpu-lite";
const MARKER="THREE_CENTER_MODELSCOPE_LITE_RUNTIME:";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const str=v=>String(v??"").trim();

function token(env={}){return str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN)}
function headers(t){return{authorization:`Bearer ${t}`,accept:"application/json"}}
async function req(url,t,timeout=15000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{method:"GET",headers:headers(t),signal:c.signal});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    return{ok:r.ok,status:r.status,data,text:text.slice(0,4096)};
  }catch(e){return{ok:false,status:e?.name==="AbortError"?504:0,data:null,text:"",error:e?.name==="AbortError"?"TIMEOUT":str(e?.message)||"FETCH_FAILED"}}
  finally{clearTimeout(timer)}
}
function objects(v,out=[]){if(out.length>512)return out;if(Array.isArray(v)){for(const x of v)objects(x,out)}else if(v&&typeof v==="object"){out.push(v);for(const x of Object.values(v))objects(x,out)}return out}
function strings(v,out=[]){if(out.length>4096)return out;if(typeof v==="string")out.push(v);else if(Array.isArray(v)){for(const x of v)strings(x,out)}else if(v&&typeof v==="object"){for(const x of Object.values(v))strings(x,out)}return out}
function username(raw){for(const o of objects(raw)){for(const k of ["Username","username","preferred_username","user_name","userName","name"]){const v=str(o?.[k]);if(v&&/^[A-Za-z0-9_.-]{1,80}$/.test(v))return v}}return null}
function clean(value,owner=""){
  let s=str(value);
  if(owner)s=s.split(owner).join("[OWNER]");
  s=s.replace(/https?:\/\/\S+/gi,"[URL]")
    .replace(/(?:bearer\s+)?[A-Za-z0-9._~-]{24,}/gi,"[REDACTED]")
    .replace(/\s+/g," ").trim();
  return s.slice(0,220);
}
function stateSnapshot(raw,owner){
  const out={};
  for(const o of objects(raw)){
    for(const [k,v] of Object.entries(o)){
      const key=String(k||"");
      if(!/(status|state|stage|phase|runtime|sdk|hardware|visibility|deploy|error)/i.test(key))continue;
      if(v===null||["string","number","boolean"].includes(typeof v)){
        const safe=clean(v,owner);if(safe&&!Object.prototype.hasOwnProperty.call(out,key))out[key]=safe;
      }
      if(Object.keys(out).length>=24)return out;
    }
  }
  return out;
}
function analyzeLogs(raw,owner){
  const all=strings(raw).flatMap(x=>String(x||"").split(/\r?\n/));
  const nonempty=all.map(x=>x.trim()).filter(Boolean);
  const joined=nonempty.join("\n");
  const flags={
    marker_present:joined.includes(MARKER),
    traceback:/traceback/i.test(joined),
    module_not_found:/module(?:notfounderror| not found)|no module named/i.test(joined),
    import_error:/importerror/i.test(joined),
    syntax_error:/syntaxerror/i.test(joined),
    gradio_error:/gradio/i.test(joined)&&/(error|exception|failed|traceback)/i.test(joined),
    port_error:/(address already in use|port .*in use|bind.*failed)/i.test(joined),
    permission_error:/(permission denied|forbidden)/i.test(joined),
    out_of_memory:/(out of memory|oom|killed process)/i.test(joined),
    startup_error:/(startup|launch|deploy|runtime).{0,80}(error|failed|exception)/i.test(joined)
  };
  const interesting=nonempty.filter(line=>/(traceback|error|exception|failed|no module named|permission denied|address already in use|killed process|gradio)/i.test(line));
  return{...flags,log_string_count:nonempty.length,error_samples:[...new Set(interesting.map(x=>clean(x,owner)).filter(Boolean))].slice(0,5)};
}

export async function modelScopeStudioLiteDiagnostic(env={}){
  const t=token(env);
  if(!t)return{ok:false,provider:"modelscope-studio-lite",configured:false,authenticated:false,error_class:"MODELSCOPE_TOKEN_REQUIRED",secrets_redacted:true};
  const me=await req(`${OPENAPI}/users/me`,t),owner=me.ok?username(me.data):null;
  if(!me.ok||!owner)return{ok:false,provider:"modelscope-studio-lite",configured:true,authenticated:me.status!==401&&me.status!==403,identity_http_status:me.status,error_class:!me.ok?`MODELSCOPE_IDENTITY_HTTP_${me.status}`:"MODELSCOPE_OWNER_UNRESOLVED",secrets_redacted:true};
  const base=`${OPENAPI}/studios/${encodeURIComponent(owner)}/${encodeURIComponent(REPO_NAME)}`;
  const detail=await req(base,t),logs=await req(`${base}/logs/run?page_num=1&page_size=100`,t);
  const logAnalysis=logs.ok?analyzeLogs(logs.data,owner):null;
  return{
    ok:detail.ok&&logs.ok,
    provider:"modelscope-studio-lite",
    configured:true,
    authenticated:true,
    studio_found:detail.ok,
    detail_http_status:detail.status,
    log_http_status:logs.status,
    studio_state:detail.ok?stateSnapshot(detail.data,owner):{},
    log_analysis:logAnalysis,
    runtime_marker_present:logAnalysis?.marker_present===true,
    error_class:!detail.ok?`MODELSCOPE_STUDIO_DETAIL_HTTP_${detail.status}`:!logs.ok?`MODELSCOPE_STUDIO_LOG_HTTP_${logs.status}`:logAnalysis?.marker_present===true?null:"MODELSCOPE_RUNTIME_MARKER_ABSENT",
    free_only:true,
    paid_fallback:false,
    secrets_redacted:true
  };
}

export async function maybeHandleModelScopeStudioLiteDiagnostic(req,env){
  const u=new URL(req.url);
  if(req.method!=="GET"||u.pathname!=="/_diag/mslite-runlog-K9p4")return null;
  const p=await modelScopeStudioLiteDiagnostic(env);
  return json({...p,one_shot:true},p.ok?200:503);
}
