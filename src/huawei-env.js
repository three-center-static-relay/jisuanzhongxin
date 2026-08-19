const ALNUM=/^[A-Za-z0-9]+$/;

function read(source,key){
  try{return String(source?.[key]??"").trim()}catch{return""}
}

function ownKeys(source){
  try{return Reflect.ownKeys(source||{}).filter(key=>typeof key==="string")}catch{return[]}
}

function runtimeProcessEnv(){
  try{return typeof process!=="undefined"&&process?.env?process.env:{}}catch{return{}}
}

function collectSources(env,runtimeEnv){
  const values=new Map();
  for(const source of [env,runtimeEnv]){
    for(const key of ownKeys(source)){
      if(values.has(key))continue;
      const value=read(source,key);
      if(value)values.set(key,value);
    }
  }
  return values;
}

function exactValue(env,runtimeEnv,key){
  return read(env,key)||read(runtimeEnv,key);
}

function resolveOne(env,runtimeEnv,{canonical,pattern,length}){
  const exact=exactValue(env,runtimeEnv,canonical);
  if(exact)return{value:exact,mode:"canonical",ambiguous:false};

  const matches=[];
  for(const [key,value] of collectSources(env,runtimeEnv)){
    if(key===canonical||!pattern.test(key))continue;
    if(value.length===length&&ALNUM.test(value))matches.push({key,value});
  }

  if(matches.length===1)return{value:matches[0].value,mode:"wildcard",ambiguous:false};
  return{value:"",mode:"none",ambiguous:matches.length>1};
}

export function resolveHuaweiCredentialBindings(env={},runtimeEnv=runtimeProcessEnv()){
  const ak=resolveOne(env,runtimeEnv,{canonical:"HUAWEI_CLOUD_AK",pattern:/^[HI]UAWEI_CLOUD_A[A-Z0-9_]{0,12}$/i,length:20});
  const sk=resolveOne(env,runtimeEnv,{canonical:"HUAWEI_CLOUD_SK",pattern:/^[HI]UAWEI_CLOUD_S[A-Z0-9_]{0,12}$/i,length:40});
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
