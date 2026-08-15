import {listTools} from "./kaggle-mcp.js";
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
function pushTool(tools){
  const exact=tools.find(t=>String(t?.name||"").toLowerCase()==="kernel_push");
  if(exact)return exact;
  return tools.map(t=>{const x=`${t?.name||""} ${t?.description||""}`.toLowerCase();let s=0;if(/kernel|notebook/.test(x))s+=4;if(/push|save|create/.test(x))s+=8;if(/competition/.test(x))s-=12;return{t,s}}).sort((a,b)=>b.s-a.s)[0]?.t||null;
}
export async function probePushSchema(env){
  const tools=await listTools(env),tool=pushTool(tools);
  if(!tool)return{ok:false,push_tool_present:false};
  const props=tool?.inputSchema?.properties||{},required=Array.isArray(tool?.inputSchema?.required)?tool.inputSchema.required:[];
  const keys=Object.keys(props),nk=new Set(keys.map(norm));
  const supported=new Set(["title","name","text","source","code","language","kerneltype","notebooktype","type","isprivate","private","enablegpu","gpu","enabletpu","tpu","enableinternet","internet","machineshape","accelerator"]);
  const unknownRequired=required.filter(k=>!supported.has(norm(k)));
  return{
    ok:true,
    push_tool_present:true,
    exact_kernel_push:String(tool.name||"").toLowerCase()==="kernel_push",
    accepts_title:nk.has("title")||nk.has("name"),
    accepts_text:nk.has("text")||nk.has("source")||nk.has("code"),
    accepts_language:nk.has("language"),
    accepts_kernel_type:nk.has("kerneltype")||nk.has("notebooktype")||nk.has("type"),
    accepts_private:nk.has("isprivate")||nk.has("private"),
    accepts_slug:nk.has("slug")||nk.has("ref")||nk.has("kernel")||nk.has("notebook"),
    required_count:required.length,
    required_supported:unknownRequired.length===0,
    unknown_required_count:unknownRequired.length,
    property_count:keys.length
  };
}
