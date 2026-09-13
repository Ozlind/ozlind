(() => {
"use strict";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const I=id=>`<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

const K={chats:"ozlind:v4:chats",settings:"ozlind:v4:settings"};
let chats=load(K.chats,[]),active=chats[0]?.id||null,files=[],controller=null,busy=false;

let settings={
  responseLength:"medium",
  responseStyle:"balanced",
  memory:true,
  instructions:"",
  ...load(K.settings,{})
};

function load(k,f){
  try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}
}
function save(k,v){
  try{
    localStorage.setItem(k,JSON.stringify(v));
    return true
  }catch{
    toast("Storage is full. Export history and remove older conversations.","error");
    return false
  }
}
function id(){
  return crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}`
}
function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]))
}
function toast(t,type=""){
  const x=document.createElement("div");
  x.className=`toast ${type}`;
  x.textContent=t;
  $("#toastStack").append(x);
  setTimeout(()=>x.remove(),3200)
}
function current(){return chats.find(c=>c.id===active)}
function persist(){
  chats.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  chats=chats.slice(0,60);
  save(K.chats,chats)
}
function touch(c){c.updatedAt=new Date().toISOString();persist()}
function titleFrom(t){
  return String(t||"").replace(/\s+/g," ").trim().slice(0,58)||"New chat"
}
function newChat(){
  const now=new Date().toISOString(),
    c={id:id(),title:"New chat",messages:[],createdAt:now,updatedAt:now};
  chats.unshift(c);active=c.id;touch(c);
  renderMessages();renderHistory();showView("chat");
  $("#chatInput").focus()
}
function ensureChat(){if(!current())newChat();return current()}
function closeSidebar(){
  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("open")
}
function showView(v){
  $$(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===v));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===v));
  $("#topbarTitle").textContent={
    chat:"AI Chat",history:"History",research:"Web Research",settings:"Settings"
  }[v]||"AI Chat";
  closeSidebar();
  if(v==="history")renderHistory();
  if(v==="settings")loadSettings()
}

function md(t){
  let s=esc(t),stash=[];
  const hold=h=>{
    const k=`\u0000${stash.length}\u0000`;
    stash.push(h);return k
  };
  s=s.replace(/```(?:[\w-]+)?\n?([\s\S]*?)```/g,(_,c)=>hold(`<pre><code>${c.trim()}</code></pre>`));
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>hold(`<code>${c}</code>`));
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_,l,u)=>hold(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${l}</a>`));
  s=s.replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>");
  s=s.replace(/^\s*[-*]\s+(.+)$/gm,"<li>$1</li>")
    .replace(/(?:<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
    .replace(/__([^_]+)__/g,"<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g,"<em>$1</em>");
  s=s.split(/\n{2,}/).map(b=>
    /^\s*<(h[1-3]|ul|pre)/.test(b.trim())
      ? b
      : `<p>${b.replace(/\n/g,"<br>")}</p>`
  ).join("");
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>stash[+i])||"<p></p>"
}

/* Image generation is intentionally integrated into the main chat.
   There is no separate Image Generator page. */
function isImageRequest(text){
  const t=String(text||"").toLowerCase().trim();
  if(!t)return false;

  return [
    /\b(create|generate|make|draw|design|render|produce)\b.{0,40}\b(an?\s+)?(image|picture|photo|illustration|wallpaper|poster|logo|artwork)\b/i,
    /\b(image|picture|photo|illustration|wallpaper|poster|logo|artwork)\b.{0,20}\b(create|generate|make|draw|design|render)\b/i,
    /\bturn\b.{0,30}\binto\s+(an?\s+)?(image|picture|photo)\b/i,
    /\btext\s+to\s+image\b/i,
    /\bgenerate\s+visual\b/i,
    /ചിത്രം.*(ഉണ്ടാക്ക|സൃഷ്ടി|തരൂ|വേണം)/i,
    /(image|photo|picture).*(ഉണ്ടാക്ക|generate|create|തരൂ|വേണം)/i
  ].some(rx=>rx.test(t))
}

function extractImagePrompt(text){
  return String(text||"")
    .replace(/^\s*(please\s+)?(create|generate|make|draw|design|render|produce)\s+(me\s+)?(an?\s+)?(image|picture|photo|illustration|wallpaper|poster|logo|artwork)\s*(of|for|showing|with|:)?\s*/i,"")
    .replace(/^\s*(image|picture|photo)\s*[:\-]\s*/i,"")
    .trim() || String(text||"").trim()
}

function injectImageStyles(){
  if($("#ozlindImageChatStyles"))return;
  const style=document.createElement("style");
  style.id="ozlindImageChatStyles";
  style.textContent=`
    .generated-chat-image-wrap{
      margin-top:4px;
      max-width:760px;
    }
    .generated-chat-image{
      display:block;
      width:min(100%,760px);
      max-height:720px;
      object-fit:contain;
      border:1px solid var(--border,#2A2D31);
      border-radius:18px;
      background:var(--surface2,#1C1F22);
      box-shadow:0 18px 55px rgba(0,0,0,.28);
    }
    .generated-chat-image-meta{
      display:flex;
      align-items:center;
      gap:8px;
      margin-top:10px;
      flex-wrap:wrap;
    }
    .generated-chat-image-meta button{
      min-height:38px;
      padding:0 12px;
      border:1px solid var(--border,#2A2D31);
      border-radius:10px;
      background:var(--surface,#151719);
      color:var(--dim,#9AA0A6);
      font-size:11px;
      font-weight:700;
    }
    .generated-chat-image-meta button:hover{
      background:var(--surface2,#1C1F22);
      color:var(--text,#F2F3F4);
    }
    .generated-chat-image-label{
      color:var(--faint,#5B6066);
      font-size:10px;
      letter-spacing:.1em;
      text-transform:uppercase;
      font-weight:800;
    }
    @media (max-width:700px){
      .generated-chat-image{border-radius:14px;max-height:62dvh}
      .generated-chat-image-wrap{width:100%}
    }
  `;
  document.head.append(style)
}

function renderMessages(){
  injectImageStyles();
  const box=$("#chatMessages"),c=current(),has=!!c?.messages?.length;
  box.innerHTML="";
  $("#chatWelcome").classList.toggle("hidden",has);
  if(!has)return;

  c.messages.forEach((m,i)=>{
    const a=document.createElement("article");
    a.className=`message ${m.role}${m.error?" error":""}`;

    const imgs=(m.attachments||[]).map(x=>
      `<img class="message-image" data-image="${esc(x.dataUrl)}"
        src="${esc(x.dataUrl)}" alt="${esc(x.name||"Attached image")}" loading="lazy">`
    ).join("");

    let body="";
    if(m.imageUrl){
      body=`
        <div class="generated-chat-image-wrap">
          <img class="generated-chat-image"
               src="${esc(m.imageUrl)}"
               alt="${esc(m.imagePrompt||"Generated image")}"
               loading="eager"
               referrerpolicy="no-referrer">
          <div class="generated-chat-image-meta">
            <span class="generated-chat-image-label">Generated by OZLIND</span>
            <button type="button" data-download-image="${i}">Download</button>
            <button type="button" data-regenerate-image="${i}">Regenerate</button>
          </div>
        </div>
      `;
    }else{
      body=m.role==="assistant"
        ?md(m.content)
        :`<p>${esc(m.content).replace(/\n/g,"<br>")}</p>`;
    }

    let actions;
    if(m.pending){
      actions=`<span class="thinking"><span></span><span></span><span></span> Thinking…</span>`;
    }else if(m.role==="user"){
      actions=`<button data-edit="${i}">${I("i-edit")}<span>Edit</span></button>
               <button data-delete="${i}">${I("i-delete")}<span>Delete</span></button>`;
    }else{
      actions=`<button data-copy="${i}">${I("i-copy")}<span>Copy</span></button>
               ${m.error?"":`<button data-regenerate="${i}">${I("i-regenerate")}<span>Regenerate</span></button>`}
               <button data-delete="${i}">${I("i-delete")}<span>Delete</span></button>`;
    }

    const sources=(m.sources||[]).slice(0,6).map((s,j)=>{
      let h="source";
      try{h=new URL(s.url).hostname.replace(/^www\./,"")}catch{}
      return `<a class="source-mark" href="${esc(s.url)}" target="_blank"
        rel="noopener noreferrer" title="${esc(h)}">
        <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=32" alt="">
        <span>${j+1}</span>
      </a>`
    }).join("");

    a.innerHTML=`
      <div class="message-meta">${m.role==="user"?"You":"OZLIND AI"}</div>
      ${imgs?`<div class="message-attachments">${imgs}</div>`:""}
      <div class="message-body">${body}</div>
      ${sources?`<div class="source-row">${sources}</div>`:""}
      <div class="message-actions">${actions}</div>
    `;
    box.append(a)
  });

  requestAnimationFrame(()=>{
    $("#chatScroll").scrollTop=$("#chatScroll").scrollHeight
  })
}

function renderHistory(filter=""){
  const box=$("#conversationList");
  box.innerHTML="";
  const q=filter.toLowerCase().trim();
  chats.filter(c=>
    (`${c.title} ${c.messages?.[0]?.content||""}`).toLowerCase().includes(q)
  ).forEach(c=>{
    const x=document.createElement("div");
    x.className="history-item";
    x.innerHTML=`
      <button class="history-main" data-open="${esc(c.id)}">
        <b>${esc(c.title)}</b>
        <small>${c.messages.length} message${c.messages.length===1?"":"s"}</small>
      </button>
      <div class="history-actions">
        <button data-open="${esc(c.id)}" aria-label="Open">${I("i-forward")}</button>
        <button data-delete-chat="${esc(c.id)}" aria-label="Delete">${I("i-delete")}</button>
      </div>
    `;
    box.append(x)
  });
  if(!box.children.length)box.innerHTML='<div class="history-empty">No conversations found.</div>'
}

function renderFiles(){
  const b=$("#chatAttachments");
  b.innerHTML="";
  files.forEach((f,i)=>{
    const x=document.createElement("div");
    x.className="attachment-preview";
    x.innerHTML=`
      <img src="${esc(f.dataUrl)}" alt="${esc(f.name)}">
      <button data-remove-file="${i}" aria-label="Remove image">${I("i-close")}</button>
    `;
    b.append(x)
  })
}

function resize(){
  const x=$("#chatInput");
  x.style.height="auto";
  x.style.height=Math.min(x.scrollHeight,170)+"px"
}

function imageData(file){
  return new Promise((ok,no)=>{
    const r=new FileReader();
    r.onerror=no;
    r.onload=()=>{
      const im=new Image();
      im.onerror=no;
      im.onload=()=>{
        const scale=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),
          w=Math.max(1,Math.round(im.naturalWidth*scale)),
          h=Math.max(1,Math.round(im.naturalHeight*scale)),
          c=document.createElement("canvas");
        c.width=w;c.height=h;
        c.getContext("2d").drawImage(im,0,0,w,h);
        ok({
          name:file.name,
          type:"image/jpeg",
          dataUrl:c.toDataURL("image/jpeg",.82)
        })
      };
      im.src=r.result
    };
    r.readAsDataURL(file)
  })
}

async function addFiles(list){
  for(const f of [...list]){
    if(files.length>=3){
      toast("Up to 3 images can be attached.","error");
      break
    }
    if(!f.type.startsWith("image/")){
      toast("Only images are supported.","error");
      continue
    }
    try{files.push(await imageData(f))}
    catch{toast("That image could not be prepared.","error")}
  }
  renderFiles();
  $("#fileInput").value=""
}

function payload(c){
  return (settings.memory?c.messages.slice(-24):c.messages.slice(-1))
    .filter(m=>m.role==="user"||m.role==="assistant")
    .map(m=>m.role==="user"&&m.attachments?.length
      ?{
          role:"user",
          content:[
            {type:"text",text:m.content||"Please analyse the attached image."},
            ...m.attachments.map(a=>({
              type:"image_url",
              image_url:{url:a.dataUrl}
            }))
          ]
        }
      :{role:m.role,content:m.content})
}

function activity(t=""){
  const x=$("#activityStatus");
  x.textContent=t;
  x.classList.toggle("visible",!!t)
}

function busyState(v){
  busy=v;
  $("#sendBtn").classList.toggle("hidden",v);
  $("#stopBtn").classList.toggle("hidden",!v);
  $("#chatInput").disabled=v;
  $("#attachBtn").disabled=v
}

async function generateImage(c,ai,prompt){
  controller=new AbortController();
  busyState(true);
  activity("Creating image…");
  ai.pending=true;
  ai.imageGenerating=true;
  renderMessages();

  try{
    const r=await fetch("/api/image-generate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({
        prompt,
        width:1024,
        height:1024,
        model:"flux"
      })
    });

    let d={};
    try{d=await r.json()}catch{}

    if(!r.ok||!d.success||!d.imageUrl){
      throw Error(d.error||"OZLIND couldn't create that image.")
    }

    ai.pending=false;
    ai.imageGenerating=false;
    ai.imageUrl=d.imageUrl;
    ai.imagePrompt=d.prompt||prompt;
    ai.content="";
    ai.generationMeta={
      width:d.width,
      height:d.height,
      model:d.model
    };
  }catch(e){
    ai.pending=false;
    ai.imageGenerating=false;
    if(e.name==="AbortError"){
      ai.error=true;
      ai.content="Image generation stopped.";
    }else{
      ai.error=true;
      ai.content=e.message||"OZLIND couldn't create that image.";
      toast(ai.content,"error")
    }
  }finally{
    controller=null;
    busyState(false);
    activity("");
    touch(c);
    renderMessages()
  }
}

async function stream(c,ai){
  controller=new AbortController();
  busyState(true);
  activity("Thinking…");
  ai.pending=true;
  renderMessages();

  try{
    const r=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({
        messages:payload(c),
        model:"auto",
        research:$("#researchToggle").getAttribute("aria-pressed")==="true",
        responseLength:settings.responseLength,
        responseStyle:settings.responseStyle,
        memory:settings.memory,
        customInstructions:settings.instructions
      })
    });

    if(!r.ok){
      let msg="OZLIND couldn't complete that request.";
      try{const d=await r.json();if(d?.error)msg=d.error}catch{}
      throw Error(msg)
    }

    if(!r.body)throw Error("OZLIND couldn't open a response stream.");

    const rd=r.body.getReader(),dec=new TextDecoder();
    let buf="";

    for(;;){
      const {value,done}=await rd.read();
      if(done)break;

      buf+=dec.decode(value,{stream:true});
      const lines=buf.split(/\r?\n/);
      buf=lines.pop()||"";

      for(const line of lines){
        if(!line.startsWith("data:"))continue;
        const raw=line.slice(5).trim();
        if(!raw||raw==="[DONE]")continue;

        let d;
        try{d=JSON.parse(raw)}catch{continue}

        if(d.type==="status"&&d.status==="researching")
          activity("Researching…");

        if(d.type==="delta"){
          ai.pending=false;
          ai.content+=d.content||"";
          renderMessages()
        }

        if(d.type==="sources")ai.sources=d.sources||[];

        if(d.type==="error")
          throw Error(d.error||"OZLIND couldn't complete that request.")
      }
    }

    ai.pending=false;
    if(!ai.content.trim())
      ai.content="I couldn't generate a response. Please try again."
  }catch(e){
    ai.pending=false;
    if(e.name==="AbortError")ai.content="Generation stopped.";
    else{
      ai.error=true;
      ai.content=e.message||"OZLIND couldn't complete that request.";
      toast(ai.content,"error")
    }
  }finally{
    controller=null;
    busyState(false);
    activity("");
    touch(c);
    renderMessages()
  }
}

async function send(){
  if(busy)return;

  const input=$("#chatInput"),
    text=input.value.trim();

  if(!text&&!files.length)return;

  const c=ensureChat(),
    sent=files.splice(0,3),
    now=new Date().toISOString();

  renderFiles();

  c.messages.push({
    role:"user",
    content:text,
    attachments:sent,
    createdAt:now
  });

  if(c.messages.length===1)
    c.title=titleFrom(text||"Image analysis");

  touch(c);
  input.value="";
  resize();

  const ai={
    role:"assistant",
    content:"",
    pending:true,
    createdAt:new Date().toISOString()
  };

  c.messages.push(ai);
  renderMessages();

  /* If the user explicitly asks for an image, OZLIND handles it
     as a creation request instead of sending it to the chat model. */
  if(text&&!sent.length&&isImageRequest(text)){
    const imagePrompt=extractImagePrompt(text);
    ai.imagePrompt=imagePrompt;
    await generateImage(c,ai,imagePrompt);
    return
  }

  await stream(c,ai)
}

async function regenerate(i){
  if(busy)return;
  const c=current(),old=c?.messages?.[i];
  if(!c||old?.role!=="assistant")return;

  if(old.imageUrl){
    let u=i-1;
    while(u>=0&&c.messages[u].role!=="user")u--;
    if(u<0)return;

    const userText=c.messages[u].content||old.imagePrompt||"";
    c.messages=c.messages.slice(0,i);
    const ai={
      role:"assistant",
      content:"",
      pending:true,
      createdAt:new Date().toISOString()
    };
    c.messages.push(ai);
    touch(c);
    renderMessages();
    await generateImage(c,ai,extractImagePrompt(userText));
    return
  }

  let u=i-1;
  while(u>=0&&c.messages[u].role!=="user")u--;
  if(u<0)return;

  c.messages=c.messages.slice(0,i);
  const ai={
    role:"assistant",
    content:"",
    pending:true,
    createdAt:new Date().toISOString()
  };
  c.messages.push(ai);
  touch(c);
  renderMessages();
  await stream(c,ai)
}

function edit(i){
  const c=current(),m=c?.messages?.[i];
  if(!c||m?.role!=="user")return;
  $("#chatInput").value=m.content||"";
  files=(m.attachments||[]).map(x=>({...x}));
  c.messages=c.messages.slice(0,i);
  touch(c);
  renderFiles();
  resize();
  renderMessages();
  showView("chat");
  $("#chatInput").focus()
}

function del(i){
  const c=current(),m=c?.messages?.[i];
  if(!c)return;
  if(m.role==="user"&&c.messages[i+1]?.role==="assistant")
    c.messages.splice(i,2);
  else
    c.messages.splice(i,1);
  touch(c);
  renderMessages()
}

function delChat(id){
  chats=chats.filter(c=>c.id!==id);
  active=active===id?(chats[0]?.id||null):active;
  save(K.chats,chats);
  if(!active){newChat();return}
  renderMessages();
  renderHistory()
}

async function copy(i){
  try{
    await navigator.clipboard.writeText(current()?.messages?.[i]?.content||"");
    toast("Copied","success")
  }catch{
    toast("Copy is unavailable on this device.","error")
  }
}

async function downloadGeneratedImage(i){
  const m=current()?.messages?.[i];
  if(!m?.imageUrl)return;

  try{
    const r=await fetch(m.imageUrl,{mode:"cors"});
    if(!r.ok)throw Error();
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`ozlind-image-${Date.now()}.jpg`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch{
    window.open(m.imageUrl,"_blank","noopener,noreferrer")
  }
}

function preview(src){
  const v=document.createElement("div");
  v.className="image-viewer";
  v.innerHTML=`
    <img src="${esc(src)}" alt="Image preview">
    <button class="icon-button" aria-label="Close">${I("i-close")}</button>
  `;
  v.onclick=()=>v.remove();
  document.body.append(v)
}

function loadSettings(){
  $("#responseLength").value=settings.responseLength;
  $("#responseStyle").value=settings.responseStyle;
  $("#customInstructions").value=settings.instructions;
  $("#memoryToggle").setAttribute("aria-checked",String(settings.memory))
}

function saveSettings(){
  settings.responseLength=$("#responseLength").value;
  settings.responseStyle=$("#responseStyle").value;
  settings.instructions=$("#customInstructions").value.slice(0,5000);
  save(K.settings,settings);
  toast("Settings saved","success")
}

function toggleMemory(){
  settings.memory=!settings.memory;
  save(K.settings,settings);
  loadSettings();
  toast(settings.memory?"Memory enabled":"Memory disabled","success")
}

function exportHistory(){
  const b=new Blob([JSON.stringify(chats,null,2)],{type:"application/json"}),
    a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download="ozlind-history.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}

function importHistory(f){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!Array.isArray(d))throw 0;
      chats=d.filter(c=>c&&c.id&&Array.isArray(c.messages)).slice(0,60);
      active=chats[0]?.id||null;
      save(K.chats,chats);
      renderMessages();
      renderHistory();
      toast("History imported","success")
    }catch{
      toast("Invalid history file.","error")
    }
  };
  r.readAsText(f)
}

function openModel(){
  $("#modelModal").classList.add("open");
  $("#modelModal").setAttribute("aria-hidden","false");
  $("#modelTrigger").setAttribute("aria-expanded","true")
}
function closeModel(){
  $("#modelModal").classList.remove("open");
  $("#modelModal").setAttribute("aria-hidden","true");
  $("#modelTrigger").setAttribute("aria-expanded","false")
}

document.addEventListener("click",e=>{
  const v=e.target.closest("[data-view]");
  if(v)return showView(v.dataset.view);

  if(e.target.closest("#newChatBtn"))return newChat();

  if(e.target.closest("#mobileNavBtn")){
    $("#sidebar").classList.add("open");
    $("#sidebarOverlay").classList.add("open");
    return
  }

  if(e.target.closest("#sidebarClose")||e.target.closest("#sidebarOverlay"))
    return closeSidebar();

  if(e.target.closest("[data-focus-chat]")){
    showView("chat");
    $("#chatInput").focus();
    return
  }

  const p=e.target.closest("[data-prompt]");
  if(p){
    $("#chatInput").value=p.dataset.prompt;
    resize();
    $("#chatInput").focus();
    return
  }

  const o=e.target.closest("[data-open]");
  if(o){
    active=o.dataset.open;
    renderMessages();
    showView("chat");
    return
  }

  const dc=e.target.closest("[data-delete-chat]");
  if(dc){
    if(confirm("Delete this conversation?"))delChat(dc.dataset.deleteChat);
    return
  }

  const cp=e.target.closest("[data-copy]");
  if(cp)return copy(+cp.dataset.copy);

  const ed=e.target.closest("[data-edit]");
  if(ed)return edit(+ed.dataset.edit);

  const rg=e.target.closest("[data-regenerate]");
  if(rg)return regenerate(+rg.dataset.regenerate);

  const dl=e.target.closest("[data-delete]");
  if(dl)return del(+dl.dataset.delete);

  const di=e.target.closest("[data-download-image]");
  if(di)return downloadGeneratedImage(+di.dataset.downloadImage);

  const ri=e.target.closest("[data-regenerate-image]");
  if(ri)return regenerate(+ri.dataset.regenerateImage);

  const rm=e.target.closest("[data-remove-file]");
  if(rm){
    files.splice(+rm.dataset.removeFile,1);
    renderFiles();
    return
  }

  const im=e.target.closest("[data-image]");
  if(im)return preview(im.dataset.image);

  if(e.target.closest("#attachBtn"))
    return $("#fileInput").click();

  if(e.target.closest("#stopBtn"))
    return controller?.abort();

  if(e.target.closest("#researchToggle")){
    const b=$("#researchToggle"),
      on=b.getAttribute("aria-pressed")==="true";
    b.setAttribute("aria-pressed",String(!on));
    b.querySelector("b").textContent=!on?"ON":"OFF";
    return
  }

  if(e.target.closest("#modelTrigger"))return openModel();
  if(e.target.closest("[data-close-model]"))return closeModel();
  if(e.target.closest("#memoryToggle"))return toggleMemory();
  if(e.target.closest("#saveInstructionsBtn"))return saveSettings();
  if(e.target.closest("#exportHistoryBtn"))return exportHistory();
  if(e.target.closest("#importHistoryBtn"))return $("#historyFileInput").click();

  if(e.target.closest("#clearHistoryBtn")){
    if(confirm("Delete all local conversation history?")){
      chats=[];active=null;save(K.chats,chats);newChat();
      toast("History cleared","success")
    }
    return
  }

  if(e.target.closest("#themeToggle"))
    return toast("OZLIND uses its dark identity theme.","success")
});

$("#chatForm").addEventListener("submit",e=>{
  e.preventDefault();
  send()
});
$("#chatInput").addEventListener("input",resize);
$("#chatInput").addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){
    e.preventDefault();
    send()
  }
});
$("#fileInput").addEventListener("change",e=>addFiles(e.target.files));
$("#conversationSearch").addEventListener("input",e=>renderHistory(e.target.value));
$("#historyFileInput").addEventListener("change",e=>{
  if(e.target.files[0])importHistory(e.target.files[0]);
  e.target.value=""
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeModel();
    closeSidebar()
  }
});

window.addEventListener("load",()=>{
  if(!chats.length)newChat();
  else{
    renderMessages();
    renderHistory();
    loadSettings()
  }
  resize()
});
})();