(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const K={chats:"ozlind:v2:chats",settings:"ozlind:v2:settings",theme:"ozlind:v2:theme"};
const el={body:document.body,pages:$("[data-page]")};

let chats=load(K.chats,[]), active=chats[0]?.id||null, files=[], controller=null, generating=false;
let settings={responseLength:"medium",responseStyle:"balanced",memory:true,instructions:"",...load(K.settings,{})};

function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{toast("Local storage is full","error")}}
function id(){return crypto?.randomUUID?.()||Date.now()+"_"+Math.random()}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(t,type=""){const x=document.createElement("div");x.className="toast "+type;x.textContent=t;$("#toastStack").append(x);setTimeout(()=>x.remove(),3200)}
function current(){return chats.find(x=>x.id===active)}
function persist(){chats.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));chats=chats.slice(0,100);save(K.chats,chats)}
function newChat(){const c={id:id(),title:"New chat",messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};chats.unshift(c);active=c.id;persist();renderMessages();renderHistory();showView("chat");$("#chatInput").focus()}
function ensureChat(){if(!current())newChat();return current()}

function showView(view){
  $$(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===view));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#topbarTitle").textContent={chat:"AI Chat",history:"History",research:"Research",vision:"Vision",settings:"Settings"}[view]||"Ozlind";
  if(view==="history")renderHistory();
  if(view==="settings")loadSettingsUI();
  $(".sidebar")?.classList.remove("open");$("#sidebarOverlay")?.classList.remove("open");
}
function renderMessages(){
 const box=$("#chatMessages"), empty=$("#chatEmpty"), c=current();
 box.innerHTML=""; if(!c||!c.messages.length){empty.classList.remove("hidden");return}
 empty.classList.add("hidden");
 c.messages.forEach((m,i)=>{const a=document.createElement("article");a.className="message "+m.role+(m.error?" error":"");a.innerHTML=`<div class="message-meta">${m.role==="user"?"You":"Ozlind AI"}</div><div class="message-body">${esc(m.content)}</div>${m.role==="assistant"&&!m.error?`<div class="message-actions"><button data-copy="${i}">Copy</button><button data-like="${i}">Like</button><button data-dislike="${i}">Dislike</button></div>`:""}`;box.append(a)});
 box.scrollTop=box.scrollHeight;
}
function renderHistory(filter=""){
 const box=$("#conversationList");box.innerHTML="";
 chats.filter(c=>(c.title+" "+c.messages.map(m=>m.content).join(" ")).toLowerCase().includes(filter.toLowerCase())).forEach(c=>{
  const x=document.createElement("div");x.className="history-item";x.innerHTML=`<div class="history-main"><b>${esc(c.title)}</b><small>${c.messages.length} messages</small></div><button class="icon-btn" data-open="${c.id}">→</button><button class="icon-btn" data-delete="${c.id}">×</button>`;box.append(x)
 })
}
function titleFrom(text){return text.replace(/\s+/g," ").trim().slice(0,70)||"New chat"}

function resize(){const x=$("#chatInput");x.style.height="auto";x.style.height=Math.min(x.scrollHeight,180)+"px"}
function renderFiles(){
 const box=$("#chatAttachments");box.innerHTML="";
 files.forEach((f,i)=>{const x=document.createElement("div");x.className="attachment";x.innerHTML=`<img src="${f.dataUrl}" alt=""><button type="button" data-file="${i}">×</button>`;box.append(x)});
 $("#contextIndicator").textContent=`${files.length} attachment${files.length===1?"":"s"}`;
}
function dataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
async function addFiles(list){
 for(const f of [...list].slice(0,4-files.length)){
  if(!f.type.startsWith("image/")||f.size>8*1024*1024){toast("Only images up to 8MB are supported","error");continue}
  files.push({name:f.name,type:f.type,dataUrl:await dataURL(f)})
 }
 renderFiles()
}

function payloadMessages(c){
 const history=settings.memory?c.messages.slice(-20):c.messages.slice(-1);
 return history.map(m=>{
   if(m.role==="user"&&m.attachments?.length){
    return {role:"user",content:[{type:"text",text:m.content},...m.attachments.map(a=>({type:"image_url",image_url:{url:a.dataUrl}}))]}
   }
   return {role:m.role,content:m.content}
 })
}

async function send(){
 if(generating)return;
 const input=$("#chatInput"), text=input.value.trim(); if(!text&&!files.length)return;
 const c=ensureChat(); const attachments=files.splice(0,4); renderFiles();
 c.messages.push({role:"user",content:text,attachments,createdAt:new Date().toISOString()});
 if(c.messages.length===1)c.title=titleFrom(text);c.updatedAt=new Date().toISOString();persist();input.value="";resize();renderMessages();
 const ai={role:"assistant",content:"",createdAt:new Date().toISOString()};c.messages.push(ai);generating=true;controller=new AbortController();
 $("#sendBtn").classList.add("hidden");$("#stopBtn").classList.remove("hidden");$("#connectionStatus").innerHTML="<i></i> Generating…";renderMessages();
 try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({
     messages:payloadMessages(c),model:$("#modelSelect").value,research:$("#researchToggle").getAttribute("aria-pressed")==="true",
     responseLength:settings.responseLength,responseStyle:settings.responseStyle,memory:settings.memory,customInstructions:settings.instructions
   })});
   if(!res.ok){let msg="Request failed ("+res.status+")";try{const d=await res.json();msg=d.error||msg}catch{}throw new Error(msg)}
   const reader=res.body.getReader(), decoder=new TextDecoder();let buffer="";
   while(true){
     const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
     const lines=buffer.split("\n");buffer=lines.pop()||"";
     for(const line of lines){
       if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;
       try{const d=JSON.parse(raw);if(d.type==="delta")ai.content+=d.content||"";if(d.type==="error")throw new Error(d.error||"Generation failed")}catch(e){if(e instanceof SyntaxError){}else throw e}
       renderMessages()
     }
   }
   if(!ai.content)ai.content="No response was returned.";
 }catch(e){if(e.name==="AbortError"){ai.content+="\n\nGeneration stopped."}else{ai.error=true;ai.content=e.message||"Request failed.";toast(ai.content,"error")}}
 finally{generating=false;controller=null;c.updatedAt=new Date().toISOString();persist();renderMessages();$("#sendBtn").classList.remove("hidden");$("#stopBtn").classList.add("hidden");$("#connectionStatus").innerHTML="<i></i> Ready"}
}

function loadSettingsUI(){
 $("#responseLength").value=settings.responseLength;$("#responseStyle").value=settings.responseStyle;$("#customInstructions").value=settings.instructions;
 $("#memoryToggle").setAttribute("aria-checked",String(settings.memory))
}
function saveSettings(){settings.responseLength=$("#responseLength").value;settings.responseStyle=$("#responseStyle").value;settings.instructions=$("#customInstructions").value.slice(0,5000);save(K.settings,settings);toast("Settings saved","success")}
function toggleMemory(){settings.memory=!settings.memory;save(K.settings,settings);loadSettingsUI();toast(settings.memory?"Memory enabled":"Memory disabled","success")}
function exportData(){const blob=new Blob([JSON.stringify(chats,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ozlind-history.json";a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x))throw 0;chats=x.filter(c=>c&&c.id&&Array.isArray(c.messages)).slice(0,100);active=chats[0]?.id||null;persist();renderMessages();renderHistory();toast("History imported","success")}catch{toast("Invalid history file","error")}};r.readAsText(file)}
function theme(){const t=load(K.theme,"dark")==="light"?"light":"dark";document.body.dataset.theme=t;save(K.theme,t);$("#themeToggle").textContent=t==="dark"?"☾":"☀"}

document.addEventListener("click",e=>{
 const view=e.target.closest("[data-view]");if(view)showView(view.dataset.view);
 const prompt=e.target.closest("[data-prompt]");if(prompt){$("#chatInput").value=prompt.dataset.prompt;resize();showView("chat");$("#chatInput").focus()}
 const open=e.target.closest("[data-open]");if(open){active=open.dataset.open;persist();renderMessages();showView("chat")}
 const del=e.target.closest("[data-delete]");if(del){chats=chats.filter(c=>c.id!==del.dataset.delete);if(active===del.dataset.delete)active=chats[0]?.id||null;persist();renderMessages();renderHistory()}
 const copy=e.target.closest("[data-copy]");if(copy){navigator.clipboard?.writeText(current()?.messages[+copy.dataset.copy]?.content||"");toast("Copied","success")}
 const like=e.target.closest("[data-like]");if(like)toast("Feedback saved","success");
 const dislike=e.target.closest("[data-dislike]");if(dislike)toast("Feedback saved","success");
 const rm=e.target.closest("[data-file]");if(rm){files.splice(+rm.dataset.file,1);renderFiles()}
 if(e.target.closest("#newChatBtn"))newChat();
 if(e.target.closest("#themeToggle"))theme();
 if(e.target.closest("#researchToggle")){const b=$("#researchToggle"),on=b.getAttribute("aria-pressed")==="true";b.setAttribute("aria-pressed",String(!on));b.querySelector("span").textContent=!on?"ON":"OFF"}
 if(e.target.closest("#mobileNavBtn")){$(".sidebar").classList.add("open");$("#sidebarOverlay").classList.add("open")}
 if(e.target.closest("#sidebarOverlay")){$(".sidebar").classList.remove("open");$("#sidebarOverlay").classList.remove("open")}
 if(e.target.closest("#attachBtn"))$("#fileInput").click();
 if(e.target.closest("#stopBtn"))controller?.abort();
 if(e.target.closest("#memoryToggle"))toggleMemory();
 if(e.target.closest("#saveInstructionsBtn"))saveSettings();
 if(e.target.closest("#exportHistoryBtn"))exportData();
 if(e.target.closest("#importHistoryBtn"))$("#historyFileInput").click();
 if(e.target.closest("#clearHistoryBtn")&&confirm("Delete all local conversation history?")){chats=[];active=null;persist();renderMessages();renderHistory();toast("History cleared","success")}
 if(e.target.closest("[data-focus-chat]"))showView("chat");
});
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();send()});
$("#chatInput").addEventListener("input",resize);$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
$("#fileInput").addEventListener("change",e=>addFiles(e.target.files));$("#conversationSearch").addEventListener("input",e=>renderHistory(e.target.value));
$("#historyFileInput").addEventListener("change",e=>e.target.files[0]&&importData(e.target.files[0]));
window.addEventListener("load",()=>{theme();if(!chats.length)newChat();else renderMessages();loadSettingsUI()});
})();
