const PROVIDERS={
  groq:{base:"https://api.groq.com/openai/v1",key:"GROQ_API_KEY",model:"GROQ_MODEL",fallback:"openai/gpt-oss-120b"},
  gemini:{base:"https://generativelanguage.googleapis.com/v1beta",key:"GEMINI_API_KEY",model:"GEMINI_MODEL",fallback:"gemini-3.6-flash"},
  experiential:{base:"https://api.experientiallabs.ai/v1",key:"EXPERIENTIAL_API_KEY",model:"EXPERIENTIAL_MODEL",fallback:"default"}
};
const LIMITS={messages:20,text:12000,imageChars:12000000,timeout:45000,research:15000,analytics:10000,researchText:9000,customInstructions:5000,visitorId:200,conversationId:100,title:200};

const json=(res,status,data)=>{res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data))};
const sseStart=res=>{res.statusCode=200;res.setHeader("Content-Type","text/event-stream; charset=utf-8");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive")};
const emit=(res,data)=>{if(!res.writableEnded)res.write(`data: ${JSON.stringify(data)}\n\n`)};
const clean=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function parseBody(req){if(req.body&&typeof req.body==="object")return req.body;throw Error("Invalid request body.")}
function normalizeMessages(input){
  if(!Array.isArray(input)||!input.length)throw Error("At least one message is required.");
  let out=input.slice(-LIMITS.messages).map(m=>{
    if(!m||!["user","assistant","system"].includes(m.role))throw Error("Invalid message role.");
    if(typeof m.content==="string")return{role:m.role,content:clean(m.content,LIMITS.text)};
    if(Array.isArray(m.content))return{role:m.role,content:m.content.map(x=>{
      if(x?.type==="text")return{type:"text",text:clean(x.text,LIMITS.text)};
      if(x?.type==="image_url"&&typeof x.image_url?.url==="string"&&x.image_url.url.startsWith("data:image/")){
        if(x.image_url.url.length>LIMITS.imageChars)throw Error("Image attachment is too large.");
        return{type:"image_url",image_url:{url:x.image_url.url}}
      } return null
    }).filter(Boolean)};
    throw Error("Invalid message content.")
  });
  out=out.filter(m=>m.role!=="system");
  let last=-1;for(let i=out.length-1;i>=0;i--)if(out[i].role==="user"){last=i;break}
  if(last<0)throw Error("A user message is required.");
  return out.slice(0,last+1)
}
function latestUser(messages){for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.role!=="user")continue;if(typeof m.content==="string")return m.content;if(Array.isArray(m.content))return m.content.filter(x=>x.type==="text").map(x=>x.text||"").join(" ")}return""}
function hasVision(messages){return messages.some(m=>Array.isArray(m.content)&&m.content.some(x=>x.type==="image_url"))}
function researchNeeded(body,q){return body.research===true||/\b(latest|current|today|now|recent|news|weather|price|stock|search|research|sources?|what happened|where is|when is)\b/i.test(q)}
async function fetchT(url,options,timeout){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}

async function tavily(q){
  if(!process.env.TAVILY_API_KEY)throw Error("Live research is not configured.");
  const r=await fetchT("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.TAVILY_API_KEY}`},body:JSON.stringify({query:q.slice(0,500),topic:"general",search_depth:"basic",max_results:5,include_answer:true})},LIMITS.research);
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error("Live research is temporarily unavailable.");
  return {answer:d.answer||"",results:(d.results||[]).slice(0,5).map(x=>({title:x.title||"",url:x.url||"",domain:(()=>{try{return new URL(x.url||"").hostname.replace(/^www\./,"")}catch{return ""}})(),content:x.content||""})).filter(x=>/^https?:\/\//i.test(x.url))}
}
function systemPrompt(body,research){
  const len=["short","medium","long"].includes(body.responseLength)?body.responseLength:"medium";
  const style=["balanced","professional","friendly","direct"].includes(body.responseStyle)?body.responseStyle:"balanced";
  const custom=clean(body.customInstructions,LIMITS.customInstructions);
  const sourceText=research?`\nCURRENT WEB RESEARCH:\n${research.answer?`Summary: ${research.answer}\n`:""}${research.results.map((x,i)=>`[${i+1}] ${x.title}\nURL: ${x.url}\n${x.content}`).join("\n\n")}\nUse these sources for current facts. Do not invent details.`:"";
  return `You are OZLIND AI, the official assistant of the OZLIND AI platform.
IDENTITY: If asked who created you, say "I was created by Athul as part of the OZLIND AI platform." Do not claim Athul created third-party models.
STYLE: Answer the exact question first. Be concise, natural and useful. Simple questions normally need 1–3 sentences. Do not pad, repeat, or expose backend/provider details. Use bullets only when they improve clarity. If uncertain, say so.
RESPONSE LENGTH: ${len}
STYLE MODE: ${style}
MEMORY: ${body.memory===false?"Use only the supplied current context.":"Use relevant supplied conversation context."}
${custom?`CUSTOM INSTRUCTIONS:\n${custom}`:""}${sourceText}`
}
function gemParts(content){if(typeof content==="string")return[{text:content}];return content.map(x=>x.type==="text"?{text:x.text||""}:x.type==="image_url"?{inline_data:{mime_type:x.image_url.url.match(/^data:([^;]+);base64,/)?.[1]||"image/jpeg",data:x.image_url.url.split(",")[1]}}:null).filter(Boolean)}
async function openai(provider,messages,system){
  const c=PROVIDERS[provider],key=process.env[c.key];if(!key)throw Error(`${provider} is not configured.`);
  const model=process.env[c.model]||c.fallback;if(!model)throw Error(`${provider} model is not configured.`);
  const r=await fetchT(`${c.base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:.3,stream:false})},LIMITS.timeout);
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${provider} request failed (${r.status}).`);
  const text=d.choices?.[0]?.message?.content||"";if(!text)throw Error(`${provider} returned an empty response.`);
  return{provider,model,text,usage:d.usage||{}}
}
async function gemini(messages,system){
  const c=PROVIDERS.gemini,key=process.env[c.key];if(!key)throw Error("gemini is not configured.");
  const model=process.env[c.model]||c.fallback,contents=[];
  for(const m of messages){if(!["user","assistant"].includes(m.role))continue;const parts=gemParts(m.content);if(!parts.length)continue;const role=m.role==="assistant"?"model":"user";if(contents.at(-1)?.role===role)contents.at(-1).parts.push(...parts);else contents.push({role,parts})}
  while(contents[0]?.role==="model")contents.shift();while(contents.at(-1)?.role==="model")contents.pop();if(!contents.length||contents.at(-1).role!=="user")throw Error("Gemini request context is invalid.");
  const r=await fetchT(`${c.base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{}})},LIMITS.timeout);
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(`gemini request failed (${r.status}).`);
  const text=d.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";if(!text)throw Error("gemini returned an empty response.");
  return{provider:"gemini",model,text,usage:{input_tokens:d.usageMetadata?.promptTokenCount||0,output_tokens:d.usageMetadata?.candidatesTokenCount||0}}
}
async function geminiRequest(messages,system,stream=false){
  const c=PROVIDERS.gemini,key=process.env[c.key];if(!key)throw Error("gemini is not configured.");
  const model=process.env[c.model]||c.fallback,contents=[];
  for(const m of messages){if(!["user","assistant"].includes(m.role))continue;const parts=gemParts(m.content);if(!parts.length)continue;const role=m.role==="assistant"?"model":"user";if(contents.at(-1)?.role===role)contents.at(-1).parts.push(...parts);else contents.push({role,parts})}
  while(contents[0]?.role==="model")contents.shift();while(contents.at(-1)?.role==="model")contents.pop();if(!contents.length||contents.at(-1).role!=="user")throw Error("Gemini request context is invalid.");
  const method=stream?"streamGenerateContent":"generateContent";
  const query=stream?`?alt=sse&key=${encodeURIComponent(key)}`:`?key=${encodeURIComponent(key)}`;
  const r=await fetchT(`${c.base}/models/${encodeURIComponent(model)}:${method}${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{}})},LIMITS.timeout);
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(`gemini request failed (${r.status})${d.error?.message?`: ${d.error.message}`:"."}`)}
  return {response:r,provider:"gemini",model};
}
async function streamOpenAI(provider,messages,system,onDelta){
  const c=PROVIDERS[provider],key=process.env[c.key];if(!key)throw Error(`${provider} is not configured.`);
  const model=process.env[c.model]||c.fallback;if(!model)throw Error(`${provider} model is not configured.`);
  const r=await fetchT(`${c.base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:.3,stream:true})},LIMITS.timeout);
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(`${provider} request failed (${r.status})${d.error?.message?`: ${d.error.message}`:"."}`)}
  if(!r.body)throw Error(`${provider} returned no stream.`);
  const rd=r.body.getReader(),dec=new TextDecoder();let buf="",text="";
  for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split(/\r?\n/);buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;let d;try{d=JSON.parse(raw)}catch{continue}const delta=d.choices?.[0]?.delta?.content||"";if(delta){text+=delta;onDelta(delta)}}}
  return{provider,model,text,usage:{}}
}
async function streamGemini(messages,system,onDelta){
  const {response,provider,model}=await geminiRequest(messages,system,true);const rd=response.body?.getReader();if(!rd)throw Error("gemini returned no stream.");const dec=new TextDecoder();let buf="",text="";
  for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split(/\r?\n/);buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw)continue;let d;try{d=JSON.parse(raw)}catch{continue}const delta=d.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"";if(delta){text+=delta;onDelta(delta)}}}
  return{provider,model,text,usage:{}}
}
function orderFor(selected,vision){
  if(vision)return["gemini"];
  if(selected==="gemini")return["gemini","groq","experiential"];
  if(selected==="experiential")return["experiential","groq","gemini"];
  if(selected==="groq")return["groq","gemini","experiential"];
  return["groq","gemini","experiential"]
}
async function answer(order,messages,system){let last;for(const p of order){try{return p==="gemini"?await gemini(messages,system):await openai(p,messages,system)}catch(e){last=e}}throw last||Error("No AI provider is configured.")}
async function streamAnswer(order,messages,system,onDelta){let last;let emitted=false;const wrapped=d=>{emitted=true;onDelta(d)};for(const p of order){try{const r=p==="gemini"?await streamGemini(messages,system,wrapped):await streamOpenAI(p,messages,system,wrapped);if(!r.text.trim())throw Error(`${p} returned an empty response.`);return r}catch(e){if(emitted)throw e;last=e}}throw last||Error("No AI provider is configured.")}
function safeError(e){const s=String(e?.message||"Unable to complete the request.");return s.length>180?s.slice(0,180)+"…":s}

function supabaseEnabled(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)}
async function supabaseRequest(path,options={}){if(!supabaseEnabled())return null;const base=process.env.SUPABASE_URL.replace(/\/$/,"");const r=await fetchT(`${base}/rest/v1/${path}`,{...options,headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}`,"Content-Type":"application/json",...(options.headers||{})}},LIMITS.analytics);if(!r.ok)throw Error(`Supabase returned ${r.status}.`);return r.status===204?null:r.json().catch(()=>null)}
function isUuid(v){return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
async function ensureAnalyticsUser(visitorId){if(!supabaseEnabled())return null;const safe=clean(visitorId,LIMITS.visitorId);if(!safe)return null;try{const x=await supabaseRequest(`ozlind_users?visitor_id=eq.${encodeURIComponent(safe)}&select=id&limit=1`);if(x?.[0]?.id)return x[0];const c=await supabaseRequest("ozlind_users",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({visitor_id:safe,role:"user",last_active_at:new Date().toISOString()})});return c?.[0]||null}catch{return null}}
async function logAnalytics(body,query,result,responseTime,errorMessage){
  if(!supabaseEnabled())return null;const user=await ensureAnalyticsUser(body.visitorId);if(!user?.id)return null;
  try{const cid=isUuid(body.conversationId)?body.conversationId:crypto.randomUUID();const p=result?.provider||null,m=result?.model||null;await supabaseRequest("ozlind_api_events",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,conversation_id:cid,provider:p,model:m,status:errorMessage?"error":"success",error_message:errorMessage||null,response_time_ms:responseTime})});return cid}catch{return null}
}

export default async function handler(req,res){
  if(req.method==="OPTIONS"){res.statusCode=204;res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type");return res.end()}
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed."});
  const started=Date.now();let body={},query="",result=null;
  try{
    body=parseBody(req);const messages=normalizeMessages(body.messages);query=latestUser(messages);const vision=hasVision(messages);if(!query.trim()&&!vision)throw Error("Please enter a message.");
    let research=null;if(researchNeeded(body,query))research=await tavily(query);
    const system=systemPrompt(body,research);sseStart(res);let streamed=false;
    const order=orderFor(body.model||body.mode,vision);
    emit(res,{type:"ready"});
    const onDelta=delta=>{streamed=true;emit(res,{type:"delta",content:delta})};
    // Vision requests use Gemini; otherwise the selected provider is preferred with safe fallback.
    result=await streamAnswer(order,messages,system,onDelta);
    emit(res,{type:"provider",provider:result.provider,model:result.model});
    if(research?.results?.length)emit(res,{type:"sources",sources:research.results});
    const conversationId=await logAnalytics(body,query,result,Date.now()-started,null);if(conversationId)emit(res,{type:"conversation",conversationId});
    if(!streamed)emit(res,{type:"delta",content:result.text});
    emit(res,{type:"done"});res.end();
  }catch(e){const msg=safeError(e);try{if(body&&query)await logAnalytics(body,query,result,Date.now()-started,msg)}catch{}if(res.headersSent){emit(res,{type:"error",error:msg});res.end()}else json(res,500,{error:msg})}
}
