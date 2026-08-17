const URL="https://modelscope.cn/openapi/v1/studios/hardware?sdk_type=gradio";
const str=v=>String(v??"").trim();
const token=env=>str(env.MODELSCOPE_API_TOKEN)||str(env.MODELSCOPE_TOKEN);

function flatten(v,path="",out=[]){
  if(out.length>=400)return out;
  if(Array.isArray(v)){
    for(let i=0;i<v.length&&out.length<400;i++)flatten(v[i],`${path}[${i}]`,out);
    return out;
  }
  if(v&&typeof v==="object"){
    for(const [k,x] of Object.entries(v)){
      const p=path?`${path}.${k}`:k;
      if(x&&typeof x==="object")flatten(x,p,out);
      else out.push({path:p,value:x});
      if(out.length>=400)break;
    }
  }
  return out;
}

function safeScalar({path,value}){
  const p=String(path||"");
  if(/token|secret|authorization|cookie|credential|password|api[_-]?key|email|phone|user(id|name)?/i.test(p))return null;
  if(!/(cpu|core|vcpu|memory|mem|ram|free|price|cost|billing|resource|hardware|instance|sku|label|display|name|type|description|quota)/i.test(p))return null;
  if(value===null||typeof value==="boolean"||typeof value==="number")return{path:p,value};
  const s=String(value);
  if(s.length>240)return{path:p,value:s.slice(0,240)};
  return{path:p,value:s};
}

export async function getModelScopeStudioHardwareShape(env={}){
  const t=token(env);
  if(!t)return{ok:false,selftest:"modelscope-studio-hardware-shape",configured:false,authenticated:false,error_class:"MODELSCOPE_TOKEN_REQUIRED",secrets_redacted:true};
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(URL,{headers:{authorization:`Bearer ${t}`,accept:"application/json","cache-control":"no-cache"},signal:c.signal});
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    const scalars=(data?flatten(data):[]).map(safeScalar).filter(Boolean).slice(0,250);
    return{ok:r.ok,selftest:"modelscope-studio-hardware-shape",configured:true,authenticated:r.status!==401&&r.status!==403,http_status:r.status,scalar_count:scalars.length,scalars,secrets_redacted:true};
  }catch(e){
    return{ok:false,selftest:"modelscope-studio-hardware-shape",configured:true,authenticated:null,http_status:e?.name==="AbortError"?504:0,error_class:e?.name==="AbortError"?"TIMEOUT":"FETCH_FAILED",secrets_redacted:true};
  }finally{clearTimeout(timer)}
}
