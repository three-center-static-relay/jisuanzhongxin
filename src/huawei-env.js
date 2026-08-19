const ALNUM=/^[A-Za-z0-9]+$/;

function read(env,key){
  try{return String(env?.[key]??"").trim()}catch{return""}
}

function keys(env){
  try{return Reflect.ownKeys(env||{}).filter(key=>typeof key==="string")}catch{return[]}
}

function resolveOne(env,{canonical,pattern,length}){
  const exact=read(env,canonical);
  if(exact)return{value:exact,mode:"canonical",ambiguous:false};

  const matches=[];
  for(const key of keys(env)){
    if(key===canonical||!pattern.test(key))continue;
    const value=read(env,key);
    if(value.length===length&&ALNUM.test(value))matches.push({key,value});
  }

  if(matches.length===1)return{value:matches[0].value,mode:"wildcard",ambiguous:false};
  return{value:"",mode:"none",ambiguous:matches.length>1};
}

export function resolveHuaweiCredentialBindings(env={}){
  const ak=resolveOne(env,{canonical:"HUAWEI_CLOUD_AK",pattern:/^[HI]UAWEI_CLOUD_A[A-Z0-9_]{0,12}$/i,length:20});
  const sk=resolveOne(env,{canonical:"HUAWEI_CLOUD_SK",pattern:/^[HI]UAWEI_CLOUD_S[A-Z0-9_]{0,12}$/i,length:40});
  return{
    ak:ak.value,
    sk:sk.value,
    ak_mode:ak.mode,
    sk_mode:sk.mode,
    ambiguous:ak.ambiguous||sk.ambiguous
  };
}

export function normalizeHuaweiEnv(env={}){
  const resolved=resolveHuaweiCredentialBindings(env);
  if((!resolved.ak&&!resolved.sk)||resolved.ambiguous)return env;
  return new Proxy(env,{get(target,prop,receiver){
    if(prop==="HUAWEI_CLOUD_AK"&&resolved.ak)return resolved.ak;
    if(prop==="HUAWEI_CLOUD_SK"&&resolved.sk)return resolved.sk;
    return Reflect.get(target,prop,receiver);
  }});
}
