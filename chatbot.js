(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = (name, className = "ui-icon") => `<svg class="${className}" aria-hidden="true"><use href="#${name}"></use></svg>`;

  const K = {
    chats: "ozlind:v3:chats",
    settings: "ozlind:v3:settings",
    theme: "ozlind:v3:theme"
  };

  let chats = normalizeChats(load(K.chats, []));
  let active = chats[0]?.id || null;
  let files = [];
  let controller = null;
  let generating = false;
  let lastRequest = null;

  let settings = {
    responseLength: "medium",
    responseStyle: "balanced",
    memory: true,
    instructions: "",
    ...load(K.settings, {})
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { toast("Local storage is full", "error"); }
  }

  function makeId() {
    try { return crypto.randomUUID(); }
    catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[c]));
  }

  function normalizeChats(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(c => c && c.id && Array.isArray(c.messages)).slice(0, 100).map(c => ({
      id: String(c.id).slice(0, 120),
      title: String(c.title || "New chat").slice(0, 100),
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
      messages: c.messages.filter(m => m && ["user","assistant"].includes(m.role)).map(m => ({
        role: m.role,
        content: String(m.content || "").slice(0, 12000),
        error: Boolean(m.error),
        sources: Array.isArray(m.sources) ? m.sources.filter(x => x?.url).slice(0,6) : [],
        createdAt: m.createdAt || new Date().toISOString(),
        attachments: Array.isArray(m.attachments) ? m.attachments.filter(a => a?.dataUrl?.startsWith("data:image/")).slice(0,4) : []
      }))
    }));
  }

  function toast(message, type = "") {
    const stack = $("#toastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function current() { return chats.find(c => c.id === active); }

  function persist() {
    chats.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    chats = chats.slice(0,100);
    save(K.chats, chats);
  }

  function newChat() {
    if (generating) return toast("Stop the current response first", "error");
    const now = new Date().toISOString();
    const chat = { id: makeId(), title: "New chat", messages: [], createdAt: now, updatedAt: now };
    chats.unshift(chat);
    active = chat.id;
    files = [];
    persist();
    renderFiles();
    renderMessages();
    renderHistory();
    showView("chat");
    setTimeout(() => $("#chatInput")?.focus(), 50);
  }

  function ensureChat() {
    if (!current()) newChat();
    return current();
  }

  const viewTitles = {
    chat:"AI Chat", history:"History", research:"Web Research", vision:"Image Generator",
    photo:"Photo Editor", code:"Code Assistant", documents:"Documents", voice:"Voice AI", settings:"Settings"
  };

  function showView(view) {
    $$(".page").forEach(p => p.classList.toggle("active", p.dataset.page === view));
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    const title = $("#topbarTitle");
    if (title) title.textContent = viewTitles[view] || "OZLIND";
    if (view === "history") renderHistory($("#conversationSearch")?.value || "");
    if (view === "settings") loadSettingsUI();
    closeSidebar();
    closeModelMenu();
  }

  function closeSidebar() {
    $(".sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("open");
  }

  function openSidebar() {
    $(".sidebar")?.classList.add("open");
    $("#sidebarOverlay")?.classList.add("open");
  }

  function titleFrom(text) {
    const clean = String(text || "").replace(/\s+/g," ").trim();
    if (!clean) return "New chat";
    return clean.length > 64 ? clean.slice(0,61) + "..." : clean;
  }

  function formatTime(iso) {
    try { return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(iso)); }
    catch { return ""; }
  }

  function renderMarkdown(source) {
    const text = escapeHTML(source || "");
    const blocks = [];
    const withCode = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_,lang,code) => {
      const token = `@@CODE_${blocks.length}@@`;
      blocks.push(`<pre><code>${code.replace(/^\n|\n$/g,"")}</code></pre>`);
      return token;
    });

    let out = withCode
      .replace(/^### (.+)$/gm,"<h3>$1</h3>")
      .replace(/^## (.+)$/gm,"<h3>$1</h3>")
      .replace(/^# (.+)$/gm,"<h3>$1</h3>")
      .replace(/^> (.+)$/gm,"<blockquote>$1</blockquote>")
      .replace(/^[-*] (.+)$/gm,"<li>$1</li>")
      .replace(/^(\d+)\. (.+)$/gm,"<li>$2</li>")
      .replace(/(<li>.*<\/li>)(?:\n|$)/g, "$1")
      .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
      .replace(/__(.+?)__/g,"<strong>$1</strong>")
      .replace(/`([^`\n]+)`/g,"<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = out.split("\n");
    const rendered = [];
    let list = null;
    for (const line of lines) {
      if (line.startsWith("<li>")) {
        if (!list) list = [];
        list.push(line);
      } else {
        if (list) { rendered.push(`<ul>${list.join("")}</ul>`); list = null; }
        if (!line.trim()) continue;
        if (/^<h3>|^<blockquote>|^<pre>|^@@CODE_/.test(line)) rendered.push(line);
        else rendered.push(`<p>${line}</p>`);
      }
    }
    if (list) rendered.push(`<ul>${list.join("")}</ul>`);
    return rendered.join("").replace(/@@CODE_(\d+)@@/g, (_,i) => blocks[Number(i)] || "");
  }

  function renderSources(sources) {
    if (!Array.isArray(sources) || !sources.length) return "";
    const visible = sources.slice(0,4);
    const extra = Math.max(0, sources.length - visible.length);
    const items = visible.map(source => {
      let domain = source.domain || "source";
      let origin = "";
      try { const url = new URL(source.url); domain = url.hostname.replace(/^www\./, ""); origin = url.origin; } catch {}
      const favicon = origin ? `${origin}/favicon.ico` : "";
      return `<a class="source-item" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(source.title || domain)}"><span class="source-logo">${favicon ? `<img src="${escapeHTML(favicon)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','${icon("src-fallback","ui-icon")}')">` : icon("src-fallback","ui-icon")}</span><span class="source-name">${escapeHTML(domain)}</span></a>`;
    }).join("");
    return `<div class="source-row" aria-label="Sources">${items}${extra ? `<span class="source-more">+${extra}</span>` : ""}</div>`;
  }

  function renderMessages() {
    const box = $("#chatMessages"), empty = $("#chatEmpty"), chat = current();
    if (!box || !empty) return;
    box.innerHTML = "";
    if (!chat || !chat.messages.length) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");

    chat.messages.forEach((message,index) => {
      const article = document.createElement("article");
      article.className = `message ${message.role}${message.error ? " error" : ""}`;
      const label = message.role === "user" ? "You" : "OZLIND AI";
      let body = message.error ? escapeHTML(message.content) : renderMarkdown(message.content);
      if (message.role === "assistant" && generating && index === chat.messages.length - 1 && !message.content) {
        body = `<span class="thinking-inline">Thinking<span>·</span><span>·</span><span>·</span></span>`;
      }
      const actions = message.role === "assistant" && !message.error ? `
        <div class="message-actions">
          <button type="button" data-copy="${index}" title="Copy response">${icon("i-copy","ui-icon tiny")}<span>Copy</span></button>
          <button type="button" data-regenerate="${index}" title="Regenerate response">${icon("i-regenerate","ui-icon tiny")}<span>Regenerate</span></button>
          <button type="button" data-delete-message="${index}" title="Delete response">${icon("i-delete","ui-icon tiny")}<span>Delete</span></button>
        </div>` : message.role === "user" ? `
        <div class="message-actions">
          <button type="button" data-edit="${index}" title="Edit message">${icon("i-edit","ui-icon tiny")}<span>Edit</span></button>
          <button type="button" data-delete-message="${index}" title="Delete message">${icon("i-delete","ui-icon tiny")}<span>Delete</span></button>
        </div>` : "";
      const sources = message.role === "assistant" ? renderSources(message.sources) : "";
      article.innerHTML = `<div class="message-meta">${escapeHTML(label)}</div><div class="message-body">${body}</div>${sources}${actions}`;
      box.appendChild(article);
    });
    box.scrollTop = box.scrollHeight;
  }

  function renderHistory(filter="") {
    const box = $("#conversationList");
    if (!box) return;
    box.innerHTML = "";
    const q = filter.trim().toLowerCase();
    const list = chats.filter(c => `${c.title} ${c.messages.map(m=>m.content).join(" ")}`.toLowerCase().includes(q));
    if (!list.length) {
      box.innerHTML = `<div class="history-empty"><div class="empty-icon">${icon("i-history")}</div><p>No conversations found.</p></div>`;
      return;
    }
    list.forEach(chat => {
      const item = document.createElement("div");
      item.className = `history-item${chat.id === active ? " active" : ""}`;
      item.innerHTML = `<div class="history-main"><b>${escapeHTML(chat.title)}</b><small>${chat.messages.length} ${chat.messages.length===1?"message":"messages"} · ${formatTime(chat.updatedAt)}</small></div><button class="icon-btn" type="button" data-open="${escapeHTML(chat.id)}" title="Open conversation">${icon("i-forward","ui-icon small")}</button><button class="icon-btn" type="button" data-delete-chat="${escapeHTML(chat.id)}" title="Delete conversation">${icon("i-delete","ui-icon small")}</button>`;
      box.appendChild(item);
    });
  }

  function resizeInput() {
    const input = $("#chatInput");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight,180)}px`;
  }

  function renderFiles() {
    const box = $("#chatAttachments");
    if (!box) return;
    box.innerHTML = "";
    files.forEach((file,index) => {
      const item = document.createElement("div");
      item.className = "attachment";
      item.innerHTML = `<img src="${escapeHTML(file.dataUrl)}" alt="${escapeHTML(file.name || "Attachment")}"><button type="button" data-file="${index}" title="Remove attachment">${icon("i-close","ui-icon tiny")}</button>`;
      box.appendChild(item);
    });
    const indicator = $("#contextIndicator");
    if (indicator) indicator.textContent = files.length ? `${files.length} attachment${files.length===1?"":"s"}` : "";
  }

  function dataURL(file) {
    return new Promise((resolve,reject) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
  }

  async function addFiles(list) {
    for (const file of [...list].slice(0,4-files.length)) {
      if (!file.type.startsWith("image/") || file.size > 8*1024*1024) { toast("Only images up to 8MB are supported","error"); continue; }
      try { files.push({name:file.name,type:file.type,dataUrl:await dataURL(file)}); }
      catch { toast(`Could not read ${file.name}`,"error"); }
    }
    renderFiles();
  }

  function payloadMessages(chat) {
    const history = settings.memory ? chat.messages.slice(-20) : chat.messages.slice(-1);
    return history.map(m => {
      if (m.role === "user" && m.attachments?.length) return { role:"user", content:[{type:"text",text:m.content},...m.attachments.map(a=>({type:"image_url",image_url:{url:a.dataUrl}}))] };
      return {role:m.role,content:m.content};
    });
  }

  function setConnection(status, text) {
    const node = $("#connectionStatus");
    if (!node) return;
    node.classList.toggle("busy",status==="busy");
    node.classList.toggle("error",status==="error");
    const label = node.querySelector("span");
    if (label) label.textContent = text;
  }

  async function streamRequest(chat, assistant) {
    const research = $("#researchToggle")?.getAttribute("aria-pressed") === "true";
    const selectedModel = $("#modelSelect")?.value || "auto";
    const request = {
      messages: payloadMessages(chat), model:selectedModel, research,
      responseLength:settings.responseLength, responseStyle:settings.responseStyle,
      memory:settings.memory, customInstructions:settings.instructions
    };
    lastRequest = { chatId:chat.id, model:selectedModel, research };

    const response = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"}, signal:controller.signal, body:JSON.stringify(request)
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try { const data=await response.json(); if(data?.error) message=data.error; } catch {}
      throw new Error(message);
    }
    if (!response.body) throw new Error("No response stream was returned.");

    const reader=response.body.getReader(), decoder=new TextDecoder();
    let buffer="";
    while(true){
      const {value,done}=await reader.read();
      if(done) break;
      buffer += decoder.decode(value,{stream:true});
      const lines=buffer.split(/\r?\n/); buffer=lines.pop()||"";
      for(const line of lines){
        if(!line.startsWith("data:")) continue;
        const raw=line.slice(5).trim(); if(!raw||raw==="[DONE]") continue;
        let data; try{data=JSON.parse(raw)}catch{continue}
        if(data.type==="delta"){assistant.content += data.content||""; renderMessages();}
        if(data.type==="sources"){assistant.sources = Array.isArray(data.sources) ? data.sources.slice(0,6) : []; renderMessages();}
        if(data.type==="error") throw new Error(data.error||"Generation failed.");
      }
    }
    if(!assistant.content.trim()) assistant.content="No response was returned.";
  }

  async function generate(chat) {
    if(generating) return;
    const assistant={role:"assistant",content:"",createdAt:new Date().toISOString()};
    chat.messages.push(assistant); generating=true; controller=new AbortController();
    $("#sendBtn")?.classList.add("hidden"); $("#stopBtn")?.classList.remove("hidden"); setConnection("busy","Thinking…"); renderMessages();
    try { await streamRequest(chat,assistant); }
    catch(e){
      if(e?.name==="AbortError") assistant.content = assistant.content.trim() ? `${assistant.content}\n\nGeneration stopped.` : "Generation stopped.";
      else { assistant.error=true; assistant.content=e?.message||"Unable to complete the request."; toast(assistant.content,"error"); setConnection("error","Unable to respond"); }
    }
    finally { generating=false; controller=null; chat.updatedAt=new Date().toISOString(); persist(); renderMessages(); $("#sendBtn")?.classList.remove("hidden"); $("#stopBtn")?.classList.add("hidden"); if(!assistant.error)setConnection("ready","Ready"); }
  }

  async function send() {
    if(generating) return;
    const input=$("#chatInput"); if(!input) return;
    const text=input.value.trim(); if(!text&&!files.length) return;
    const chat=ensureChat();
    const attachments=files.splice(0,4); renderFiles();
    chat.messages.push({role:"user",content:text,attachments,createdAt:new Date().toISOString()});
    if(chat.messages.filter(m=>m.role==="user").length===1) chat.title=titleFrom(text);
    chat.updatedAt=new Date().toISOString(); input.value=""; resizeInput(); persist(); renderMessages();
    await generate(chat);
  }

  async function regenerate(index) {
    if(generating) return;
    const chat=current(), assistant=chat?.messages?.[index];
    if(!assistant||assistant.role!=="assistant") return;
    const previousUser=chat.messages.slice(0,index).reverse().find(m=>m.role==="user");
    if(!previousUser) return toast("No user message to regenerate","error");
    chat.messages.splice(index,1); chat.updatedAt=new Date().toISOString(); persist(); renderMessages();
    await generate(chat);
  }

  function editMessage(index) {
    if(generating) return;
    const chat=current(), message=chat?.messages?.[index];
    if(!message||message.role!=="user") return;
    const input=$("#chatInput"); if(!input) return;
    input.value=message.content||"";
    files=[...(message.attachments||[]).slice(0,4)]; renderFiles();
    // Editing a turn invalidates every later generated response.
    chat.messages=chat.messages.slice(0,index);
    chat.updatedAt=new Date().toISOString(); persist(); renderMessages(); resizeInput(); input.focus();
    toast("Edit the message and send again","success");
  }

  function deleteMessage(index) {
    if(generating) return;
    const chat=current(); if(!chat?.messages?.[index]) return;
    if(chat.messages[index].role==="user" && chat.messages[index+1]?.role==="assistant") chat.messages.splice(index,2);
    else chat.messages.splice(index,1);
    chat.updatedAt=new Date().toISOString(); persist(); renderMessages();
  }

  async function copyMessage(index) {
    const message=current()?.messages?.[index]; if(!message) return;
    try { await navigator.clipboard.writeText(message.content||""); toast("Response copied","success"); }
    catch { toast("Could not copy response","error"); }
  }

  function loadSettingsUI() {
    if($("#responseLength")) $("#responseLength").value=settings.responseLength;
    if($("#responseStyle")) $("#responseStyle").value=settings.responseStyle;
    if($("#customInstructions")) $("#customInstructions").value=settings.instructions;
    $("#memoryToggle")?.setAttribute("aria-checked",String(settings.memory));
  }

  function saveSettings() {
    settings.responseLength=$("#responseLength")?.value||"medium";
    settings.responseStyle=$("#responseStyle")?.value||"balanced";
    settings.instructions=($("#customInstructions")?.value||"").slice(0,5000);
    save(K.settings,settings); toast("Settings saved","success");
  }

  function toggleMemory() { settings.memory=!settings.memory; save(K.settings,settings); loadSettingsUI(); toast(settings.memory?"Memory enabled":"Memory disabled","success"); }

  function exportData() {
    try {
      const blob=new Blob([JSON.stringify(chats,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob), link=document.createElement("a"); link.href=url; link.download="ozlind-history.json"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast("History exported","success");
    } catch { toast("Could not export history","error"); }
  }

  function importData(file) {
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{try{const data=normalizeChats(JSON.parse(reader.result)); if(!data.length) throw new Error(); chats=data; active=chats[0]?.id||null; persist(); renderMessages(); renderHistory(); toast("History imported","success");}catch{toast("Invalid history file","error");}};
    reader.onerror=()=>toast("Could not read history file","error"); reader.readAsText(file);
  }

  function setTheme(theme) { document.body.dataset.theme=theme; save(K.theme,theme); }
  function toggleTheme() { setTheme(load(K.theme,"dark")==="dark"?"light":"dark"); }
  function loadTheme() { setTheme(load(K.theme,"dark")); }

  const modelInfo={
    auto:["Auto","Recommended routing"],groq:["Groq","Fast text generation"],gemini:["Gemini","Multimodal and vision"],experiential:["Experiential","Alternative provider"]
  };
  function closeModelMenu(){const menu=$("#modelMenu"),picker=$("#modelPicker");menu?.classList.remove("open");picker?.setAttribute("aria-expanded","false");}
  function toggleModelMenu(){const menu=$("#modelMenu"),picker=$("#modelPicker");if(!menu||!picker)return;const open=menu.classList.toggle("open");picker.setAttribute("aria-expanded",String(open));}
  function selectModel(value){
    const select=$("#modelSelect"), title=$("#modelPickerTitle"), desc=$("#modelPickerDescription"); if(!select||!modelInfo[value])return;
    select.value=value; title.textContent=modelInfo[value][0]; desc.textContent=modelInfo[value][1];
    $$("#modelMenu [role=option]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.model===value)));
    closeModelMenu();
  }

  document.addEventListener("click", event => {
    const modelOption=event.target.closest("#modelMenu [data-model]");
    if(modelOption){selectModel(modelOption.dataset.model);return;}
    if(event.target.closest("#modelPicker")){toggleModelMenu();return;}
    if(!event.target.closest(".control-group")) closeModelMenu();

    const view=event.target.closest("[data-view]");
    if(view){
      if(view.classList.contains("disabled-tool")){toast("This module is coming next","success");return;}
      showView(view.dataset.view);return;
    }
    const prompt=event.target.closest("[data-prompt]");
    if(prompt){const input=$("#chatInput");if(input){input.value=prompt.dataset.prompt;resizeInput();showView("chat");input.focus();}return;}
    const open=event.target.closest("[data-open]");
    if(open){active=open.dataset.open;persist();renderMessages();renderHistory();showView("chat");return;}
    const deleteChat=event.target.closest("[data-delete-chat]");
    if(deleteChat){if(!confirm("Delete this conversation?"))return;chats=chats.filter(c=>c.id!==deleteChat.dataset.deleteChat);active=active===deleteChat.dataset.deleteChat?(chats[0]?.id||null):active;persist();renderMessages();renderHistory();return;}
    const copy=event.target.closest("[data-copy]");if(copy){copyMessage(Number(copy.dataset.copy));return;}
    const edit=event.target.closest("[data-edit]");if(edit){editMessage(Number(edit.dataset.edit));return;}
    const regen=event.target.closest("[data-regenerate]");if(regen){regenerate(Number(regen.dataset.regenerate));return;}
    const delMsg=event.target.closest("[data-delete-message]");if(delMsg){deleteMessage(Number(delMsg.dataset.deleteMessage));return;}
    const rm=event.target.closest("[data-file]");if(rm){files.splice(Number(rm.dataset.file),1);renderFiles();return;}
    if(event.target.closest("#newChatBtn")){newChat();return;}
    if(event.target.closest("#themeToggle")){toggleTheme();return;}
    if(event.target.closest("#researchToggle")){const b=$("#researchToggle"),on=b.getAttribute("aria-pressed")==="true";b.setAttribute("aria-pressed",String(!on));const label=b.querySelector("strong");if(label)label.textContent=!on?"ON":"OFF";return;}
    if(event.target.closest("#mobileNavBtn")){openSidebar();return;}
    if(event.target.closest("#sidebarOverlay")){closeSidebar();return;}
    if(event.target.closest("#attachBtn")){if(!generating)$("#fileInput")?.click();return;}
    if(event.target.closest("#stopBtn")){controller?.abort();return;}
    if(event.target.closest("#memoryToggle")){toggleMemory();return;}
    if(event.target.closest("#saveInstructionsBtn")){saveSettings();return;}
    if(event.target.closest("#exportHistoryBtn")){exportData();return;}
    if(event.target.closest("#importHistoryBtn")){if(!generating)$("#historyFileInput")?.click();return;}
    if(event.target.closest("#clearHistoryBtn")){if(!confirm("Delete all local conversation history?"))return;chats=[];active=null;persist();renderMessages();renderHistory();toast("History cleared","success");return;}
    if(event.target.closest("[data-focus-chat]")){showView("chat");return;}
  });

  $("#chatForm")?.addEventListener("submit",e=>{e.preventDefault();send();});
  $("#chatInput")?.addEventListener("input",resizeInput);
  $("#chatInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
  $("#fileInput")?.addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  $("#conversationSearch")?.addEventListener("input",e=>renderHistory(e.target.value));
  $("#historyFileInput")?.addEventListener("change",e=>{importData(e.target.files?.[0]);e.target.value="";});
  window.addEventListener("resize",resizeInput);

  window.addEventListener("load",()=>{
    loadTheme(); loadSettingsUI();
    if(!chats.length){newChat();} else {renderMessages();renderHistory();}
    resizeInput();renderFiles();selectModel($("#modelSelect")?.value||"auto");
  });
})();
