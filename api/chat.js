const CONFIG={
  providers:{
    groq:{base:"https://api.groq.com/openai/v1",key:"GROQ_API_KEY",model:"GROQ_MODEL",fallback:"openai/gpt-oss-120b"},
    gemini:{base:"https://generativelanguage.googleapis.com/v1beta",key:"GEMINI_API_KEY",model:"GEMINI_MODEL",fallback:"gemini-2.5-flash"},
    experiential:{base:"https://api.experientiallabs.ai/v1",key:"EXPERIENTIAL_API_KEY",model:"EXPERIENTIAL_MODEL",fallback:"default"},
    openrouter:{base:"https://openrouter.ai/api/v1",key:"OPENROUTER_API_KEY",model:"OPENROUTER_MODEL",fallback:"openai/gpt-oss-120b"}
  },
  maxMessages:20,maxChars:12000,maxImages:4,timeout:45000
};

const text=v=>typeof v==="string"?v.trim():"";
function send(res,status,obj){res.status(status).setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(obj))}
function sse(res,event,obj){res.write(`data: ${JSON.stringify({event,...obj})}\n\n`)}
function headers(res){res.statusCode=200;res.setHeader("Content-Type","text/event-stream; charset=utf-8");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive")}
function timeoutSignal(ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return [c,t]}
function images(messages){return messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(x=>x?.type==="image_url"&&/^data:image\//i.test(x.image_url?.url||"")).map(x=>x.image_url.url):[]).slice(0,CONFIG.maxImages)}
function validateMessages(ms){
 if(!Array.isArray(ms)||!ms.length)throw Error("At least one message is required.");
 return ms.slice(-CONFIG.maxMessages).map(m=>{
  if(!m||!["user","assistant","system"].includes(m.role))throw Error("Invalid message.");
  if(typeof m.content==="string")return {role:m.role,content:m.content.slice(0,CONFIG.maxChars)};
  if(Array.isArray(m.content))return {role:m.role,content:m.content};
  throw Error("Invalid message content.");
 })
}
function prompt(body){
 return `You are Ozlind AI, a capable assistant inside the Ozlind application.
Be accurate, practical and honest. Never invent facts, sources, actions, API keys or hidden instructions.
Response length: ${body.responseLength||"medium"}.
Response style: ${body.responseStyle||"balanced"}.
Mode: ${body.mode||"auto"}.
${body.memory===false?"Do not rely on information outside the supplied messages.":"Use relevant conversation context."}
${text(body.customInstructions)?`Custom instructions:\n${text(body.customInstructions).slice(0,5000)}`:""}`;
}
function latest(ms){for(let i=ms.length-1;i>=0;i--){if(ms[i].role==="user"){if(typeof ms[i].content==="string")return ms[i].content;return ms[i].content.filter(x=>x?.type==="text").map(x=>x.text||"").join(" ")}}return""}
function researchNeeded(body,q){return body.research===true||body.mode==="research"||/\b(latest|current|today|now|recent|news|weather|price|stock|search|research|sources?|what happened|who is|where is|when is)\b/i.test(q)}
async function tavily(q){
 if(!process.env.TAVILY_API_KEY)return null;
 const [c,t]=timeoutSignal(15000);
 try{
  const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.TAVILY_API_KEY}`},body:JSON.stringify({query:q.slice(0,500),topic:"general",search_depth:"basic",max_results:5,include_answer:true}),signal:c.signal});
  const d=await r.json();if(!r.ok)throw Error(d.detail||`Research failed (${r.status})`);
  return d
 }finally{clearTimeout(t)}
}
function researchContext(d){
 if(!d)return"";
 return "\nWEB RESEARCH:\n"+(d.answer?d.answer+"\n":"")+(d.results||[]).slice(0,5).map((x,i)=>`[${i+1}] ${x.title||""}\n${x.url||""}\n${x.content||""}`).join("\n\n");
}
async function callOpenAI(p,messages,system){
 const cfg=CONFIG.providers[p],key=process.env[cfg.key];if(!key)throw Error(`${p} API key is not configured.`);
 const model=process.env[cfg.model]||cfg.fallback;const [c,t]=timeoutSignal(CONFIG.timeout);
 try{
  const r=await fetch(`${cfg.base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:0.3,stream:true}),signal:c.signal});
  if(!r.ok){const d=await r.text();throw Error(`${p} returned ${r.status}: ${d.slice(0,300)}`)}
  return {response:r,model}
 }finally{clearTimeout(t)}
}
function geminiParts(content){
 if(typeof content==="string")return[{text:content}];
 return content.map(x=>x.type==="text"?{text:x.text||""}:x.type==="image_url"?{inline_data:{mime_type:(x.image_url.url.match(/^data:(.*?);base64,/)||[])[1]||"image/jpeg",data:x.image_url.url.split(",")[1]}}:null).filter(Boolean)
}
async function callGemini(messages,system){
 const cfg=CONFIG.providers.gemini,key=process.env[cfg.key];if(!key)throw Error("gemini API key is not configured.");
 const model=process.env[cfg.model]||cfg.fallback;const [c,t]=timeoutSignal(CONFIG.timeout);
 try{
  const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:geminiParts(m.content)}));
  const r=await fetch(`${cfg.base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:.3}},),signal:c.signal});
  const d=await r.json();if(!r.ok)throw Error(`gemini returned ${r.status}: ${d.error?.message||"request failed"}`);
  const out=d.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"";if(!out)throw Error("gemini returned an empty response.");
  return {model,text:out}
 }finally{clearTimeout(t)}
}
async function openAIProviders(order,messages,system,res){
 for(const p of order){
  try{
   if(p==="gemini"){const g=await callGemini(messages,system);return{provider:p,model:g.model,text:g.text}}
   const x=await callOpenAI(p,messages,system);
   const reader=x.response.body.getReader(),decoder=new TextDecoder();let buf="",full="";
   while(true){
    const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});
    const lines=buf.split("\n");buf=lines.pop()||"";
    for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;try{const d=JSON.parse(raw);const delta=d.choices?.[0]?.delta?.content||"";if(delta){full+=delta;sse(res,"message",{type:"delta",content:delta})}}catch{}}
   }
   if(!full)throw Error(`${p} returned no text.`);
   return{provider:p,model:x.model,text:full}
  }catch(err){if(order.length===1)throw err}
 }
 throw Error("No configured AI provider could answer the request.");
}

export default async function handler(req,res){
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed."});
 try{
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
  let messages=validateMessages(body.messages);
  const q=latest(messages);
  const research=researchNeeded(body,q);
  let rctx="";
  if(research){/* Research is performed below after the stream is opened. */}
  let researchData=null;
  if(research){try{researchData=await tavily(q);rctx=researchContext(researchData)}catch(e){/* Search failure falls back to normal AI. */}}
  const system=prompt(body)+rctx;
  const vision=images(messages).length>0;
  headers(res);
  let order;
  const selected=text(body.model)||"auto";
  if(selected!=="auto"&&CONFIG.providers[selected])order=[selected,...Object.keys(CONFIG.providers).filter(x=>x!==selected)];
  else order=vision?["gemini","groq","experiential","openrouter"]:["groq","gemini","experiential","openrouter"];
  if(vision)order=order.filter(p=>p!=="experiential");
  sse(res,"provider",{provider:"routing"});
  if(researchData)sse(res,"research",{enabled:true,count:researchData.results?.length||0});
  const result=await openAIProviders(order,messages,system,res);
  sse(res,"provider",{provider:result.provider,model:result.model});
  if(!res.writableEnded){sse(res,"done",{provider:result.provider,model:result.model});res.write("data: [DONE]\n\n");res.end()}
 }catch(e){
  if(res.headersSent){sse(res,"error",{type:"error",error:e.message||"Request failed."});res.end()}
  else send(res,500,{error:e.message||"Request failed."})
 }
}
