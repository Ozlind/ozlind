(() => {
"use strict";

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE={chats:"ozlind_chats_v4",settings:"ozlind_settings_v4",theme:"ozlind_theme_v4"};
let chats=load(STORAGE.chats,[]),active=chats[0]?.id||null,attachments=[],controller=null,busy=false;
let settings={length:"medium",style:"balanced",memory:true,instructions:"",...load(STORAGE.settings,{})};

function load(k,f){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{toast("Browser storage is full.","error")}}
function persist(){chats=chats.filter(c=>c?.id&&Array.isArray(c.messages)).slice(0,100);save(STORAGE.chats,chats)}
function uid(){return crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(msg,type=""){const s=$("#toastStack");if(!s)return;const n=document.createElement("div");n.className=`toast ${type}`;n.textContent=msg;s.append(n);setTimeout(()=>n.remove(),2800)}
function current(){return chats.find(c=>c.id===active)}
function titleOf(text){let t=String(text||"").replace(/\s+/g," ").trim().replace(/^(hi|hello|hey|hai|good morning|good afternoon|good evening)[,!. ]*/i,"").replace(/^(can you|could you|please|help me|i want to|i need to)\s+/i,"").trim();if(!t)return"New conversation";t=t[0].toUpperCase()+t.slice(1);return t.length>58?t.slice(0,58).trim()+"…":t}
function newChat(){const c={id:uid(),title:"New chat",messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};chats.unshift(c);active=c.id;persist();render();openPage("chat");setTimeout(()=>$("#chatInput")?.focus(),0)}
function openPage(view){$$(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===view));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("#topbarTitle").textContent={chat:"Chat",history:"History",research:"Research",vision:"Vision",settings:"Settings"}[view]||"OZLIND";if(view==="history")renderHistory();if(view==="settings")renderSettings();$("#sidebar")?.classList.remove("open");$("#sidebarOverlay")?.classList.remove("open")}
function resize(){const i=$("#chatInput");if(!i)return;i.style.height="auto";i.style.height=Math.min(i.scrollHeight,170)+"px"}
function render(){
 const c=current(),box=$("#chatMessages"),empty=$("#chatEmpty");if(!box||!empty)return;box.innerHTML="";
 if(!c||!c.messages.length){empty.classList.remove("hidden");return} empty.classList.add("hidden");
 c.messages.forEach((m,i)=>{
  const a=document.createElement("article");a.className=`message ${m.role}${m.error?" error":""}`;
  const body=esc(m.content).replace(/\n/g,"<br>");
  const tools=m.role==="assistant"&&!m.error?`<div class="message-tools"><button data-copy="${i}">Copy</button><button data-regenerate="${i}">Regenerate</button><button data-delete-message="${i}">Delete</button></div>`:
    m.role==="user"?`<div class="message-tools"><button data-edit="${i}">Edit</button><button data-delete-message="${i}">Delete</button></div>`:"";
  const images=m.attachments?.length?`<div class="message-images">${m.attachments.map(x=>`<img src="${esc(x.dataUrl)}" alt="">`).join("")}</div>`:"";
  a.innerHTML=`<div class="meta">${m.role==="user"?"You":"OZLIND AI"}</div><div class="body">${body||(!m.error?"Thinking…":"")}</div>${images}${tools}`;box.append(a);
 });
 requestAnimationFrame(()=>$("#chatScroll")&&( $("#chatScroll").scrollTop=$("#chatScroll").scrollHeight));
}
function renderHistory(filter=""){const list=$("#conversationList");if(!list)return;const q=filter.toLowerCase().trim();const rows=chats.filter(c=>`${c.title} ${c.messages.map(m=>m.content).join(" ")}`.toLowerCase().includes(q));list.innerHTML=rows.length?rows.map(c=>`<div class="history-item"><div class="history-main"><b>${esc(c.title)}</b><small>${c.messages.length} message${c.messages.length===1?"":"s"}</small></div><button data-open="${esc(c.id)}">→</button><button data-delete="${esc(c.id)}">×</button></div>`).join(""):`<div class="history-empty"><b>No conversations</b><small>Your saved conversations will appear here.</small></div>`}
function renderSettings(){$("#responseLength").value=settings.length;$("#responseStyle").value=settings.style;$("#customInstructions").value=settings.instructions||"";$("#memoryToggle").setAttribute("aria-pressed",String(!!settings.memory))}
function renderAttachments(){const c=$("#chatAttachments");if(!c)return;c.innerHTML=attachments.map((f,i)=>`<div class="attachment"><img src="${esc(f.dataUrl)}" alt=""><button data-remove="${i}" aria-label="Remove image">×</button></div>`).join("");$("#contextIndicator").textContent=attachments.length?`${attachments.length} image${attachments.length>1?"s":""} attached`:"Ready"}
function readImage(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
async function addFiles(files){for(const f of [...files].filter(x=>x.type.startsWith("image/")).slice(0,4-attachments.length)){if(f.size>8*1024*1024){toast("Each image must be under 8 MB.","error");continue}attachments.push({name:f.name,type:f.type,dataUrl:await readImage(f)})}renderAttachments()}
function requestMessages(c){const source=settings.memory?c.messages.slice(-20):c.messages.slice(-1);return source.map(m=>m.role==="user"&&m.attachments?.length?{role:"user",content:[{type:"text",text:m.content||""},...m.attachments.map(x=>({type:"image_url",image_url:{url:x.dataUrl}}))]}:{role:m.role,content:m.content})}
function setBusy(v){busy=v;$("#sendBtn")?.classList.toggle("hidden",v);$("#stopBtn")?.classList.toggle("hidden",!v);$("#connectionStatus").innerHTML=v?"<i></i> Thinking…":"<i></i> Ready"}
async function copyMessage(i){const m=current()?.messages[i];if(!m)return;try{await navigator.clipboard.writeText(m.content||"");toast("Copied","ok")}catch{toast("Copy unavailable.","error")}}
function deleteMessage(i){const c=current();if(!c)return;c.messages.splice(i,1);c.updatedAt=new Date().toISOString();persist();render()}
function editMessage(i){const c=current(),m=c?.messages[i];if(!m||m.role!=="user")return;$("#chatInput").value=m.content||"";attachments=m.attachments?[...m.attachments]:[];c.messages.splice(i);persist();renderAttachments();resize();openPage("chat");$("#chatInput").focus()}
async function regenerate(i){const c=current();if(!c||busy||c.messages[i]?.role!=="assistant")return;const previous=c.messages[i-1];if(!previous||previous.role!=="user")return;c.messages.splice(i,1);persist();await generate(c,previous)}
async function send(){if(busy)return;const input=$("#chatInput"),text=input.value.trim();if(!text&&!attachments.length)return;let c=current();if(!c){newChat();c=current()}const imgs=attachments.splice(0,4);renderAttachments();c.messages.push({role:"user",content:text,attachments:imgs});if(c.messages.length===1)c.title=titleOf(text||"Image analysis");c.updatedAt=new Date().toISOString();persist();input.value="";resize();render();await generate(c,c.messages[c.messages.length-1])}
async function generate(c,userMessage){
 const assistant={role:"assistant",content:""};c.messages.push(assistant);setBusy(true);controller=new AbortController();persist();render();
 try{
  const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({
   messages:requestMessages(c),model:$("#modelSelect")?.value||"auto",research:$("#researchToggle")?.getAttribute("aria-pressed")==="true",
   responseLength:settings.length,responseStyle:settings.style,memory:settings.memory,customInstructions:settings.instructions
  })});
  if(!r.ok){let msg=`Request failed (${r.status}).`;try{const d=await r.json();if(d?.error)msg=d.error}catch{}throw Error(msg)}
  if(!r.body)throw Error("No response returned from OZLIND.");
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer="";
  while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;let d;try{d=JSON.parse(raw)}catch{continue}if(d.type==="delta"){assistant.content+=d.content||"";render()}if(d.type==="error")throw Error(d.error||"Generation failed.")}}
  if(!assistant.content.trim())throw Error("OZLIND returned an empty response.");
 }catch(e){if(e?.name==="AbortError"){if(!assistant.content.trim())assistant.content="Generation stopped.";else assistant.content+="\n\nGeneration stopped."}else{assistant.error=true;assistant.content=e?.message||"Unable to complete the request.";toast(assistant.content,"error")}}
 finally{c.updatedAt=new Date().toISOString();persist();render();setBusy(false);controller=null}
}
function toggleTheme(){const n=document.body.dataset.theme==="dark"?"light":"dark";document.body.dataset.theme=n;save(STORAGE.theme,n);$("#themeToggle").textContent=n==="dark"?"☾":"☀"}
function toggleResearch(){const b=$("#researchToggle"),on=b.getAttribute("aria-pressed")==="true";b.setAttribute("aria-pressed",String(!on));b.querySelector("em").textContent=!on?"ON":"OFF"}
document.addEventListener("click",async e=>{
 const nav=e.target.closest("[data-view]");if(nav){openPage(nav.dataset.view);return}
 const p=e.target.closest("[data-prompt]");if(p){openPage("chat");$("#chatInput").value=p.dataset.prompt;resize();$("#chatInput").focus();return}
 if(e.target.closest("#newChatBtn")){newChat();return}
 if(e.target.closest("#themeToggle")){toggleTheme();return}
 if(e.target.closest("#mobileNavBtn")){$("#sidebar").classList.add("open");$("#sidebarOverlay").classList.add("open");return}
 if(e.target.closest("#sidebarOverlay")){$("#sidebar").classList.remove("open");$("#sidebarOverlay").classList.remove("open");return}
 if(e.target.closest("#attachBtn")){$("#fileInput").click();return}
 if(e.target.closest("#stopBtn")){controller?.abort();return}
 if(e.target.closest("[data-go-chat]")){openPage("chat");return}
 if(e.target.closest("#researchToggle")){toggleResearch();return}
 const rem=e.target.closest("[data-remove]");if(rem){attachments.splice(Number(rem.dataset.remove),1);renderAttachments();return}
 const op=e.target.closest("[data-open]");if(op){active=op.dataset.open;render();openPage("chat");return}
 const del=e.target.closest("[data-delete]");if(del){if(confirm("Delete this conversation?")){chats=chats.filter(c=>c.id!==del.dataset.delete);if(active===del.dataset.delete)active=chats[0]?.id||null;persist();renderHistory();render();toast("Conversation deleted.","ok")}return}
 const cm=e.target.closest("[data-copy]");if(cm){copyMessage(Number(cm.dataset.copy));return}
 const dm=e.target.closest("[data-delete-message]");if(dm){deleteMessage(Number(dm.dataset.deleteMessage));return}
 const ed=e.target.closest("[data-edit]");if(ed){editMessage(Number(ed.dataset.edit));return}
 const rg=e.target.closest("[data-regenerate]");if(rg){await regenerate(Number(rg.dataset.regenerate));return}
 if(e.target.closest("#memoryToggle")){settings.memory=!settings.memory;save(STORAGE.settings,settings);renderSettings();return}
 if(e.target.closest("#saveInstructionsBtn")){settings.length=$("#responseLength").value;settings.style=$("#responseStyle").value;settings.instructions=$("#customInstructions").value.slice(0,5000);save(STORAGE.settings,settings);toast("Settings saved.","ok");return}
 if(e.target.closest("#exportHistoryBtn")){const a=document.createElement("a");const u=URL.createObjectURL(new Blob([JSON.stringify(chats,null,2)],{type:"application/json"}));a.href=u;a.download="ozlind-history.json";a.click();URL.revokeObjectURL(u);return}
 if(e.target.closest("#importHistoryBtn")){$("#historyFileInput").click();return}
 if(e.target.closest("#clearHistoryBtn")){if(confirm("Clear all local history?")){chats=[];active=null;persist();renderHistory();render();toast("History cleared.","ok")}return}
});
$("#chatForm")?.addEventListener("submit",e=>{e.preventDefault();send()});
$("#chatInput")?.addEventListener("input",resize);
$("#chatInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
$("#fileInput")?.addEventListener("change",e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value=""});
$("#conversationSearch")?.addEventListener("input",e=>renderHistory(e.target.value));
$("#historyFileInput")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!Array.isArray(data))throw 0;chats=data.filter(c=>c?.id&&Array.isArray(c.messages)).slice(0,100);active=chats[0]?.id||null;persist();renderHistory();render();toast("History imported.","ok")}catch{toast("Invalid history file.","error")}};r.readAsText(f);e.target.value=""});
window.addEventListener("load",()=>{const t=load(STORAGE.theme,"dark");document.body.dataset.theme=t==="light"?"light":"dark";$("#themeToggle").textContent=document.body.dataset.theme==="dark"?"☾":"☀";if(!chats.length)newChat();else render();renderSettings();renderAttachments();resize()});
})();