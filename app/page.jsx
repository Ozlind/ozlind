"use client";

import { useEffect } from "react";

const markup = `

  <div class="ozlind-boot" id="ozlindBoot" role="status" aria-label="OZLIND AI loading">
    <div class="boot-inner">
      <div class="boot-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
      <div class="boot-name">OZLIND</div>
      <div class="boot-subtitle">AI PLATFORM</div>
      <div class="boot-dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  </div>

  <!-- Exact OZLIND identity sprite. Runtime uses local <use> references for reliable mobile rendering. -->
  <div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="OZLIND navigation">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
        <div class="brand-copy"><strong>OZLIND</strong><span>AI WORKSPACE</span></div>
      </div>

      <button class="btn btn-primary new-chat" id="newChatBtn" type="button">
        <svg class="ui-icon"><use href="/ozlind-icons.svg#i-new-conversation"></use></svg>
        <span>New chat</span>
      </button>

      <nav class="nav" aria-label="Workspace">
        <div class="nav-section-label">WORKSPACE</div>
        <button class="nav-item active" data-view="chat" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-ai-chat"></use></svg><span>Chat</span><em>LIVE</em>
        </button>
        <button class="nav-item" data-view="history" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-history"></use></svg><span>History</span>
        </button>

        <div class="nav-section-label">AI TOOLS</div>
        <button class="nav-item" data-view="research" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-web-research"></use></svg><span>Web Research</span><em>LIVE</em>
        </button>
        <button class="nav-item disabled-tool" data-view="photo" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-photo-editor"></use></svg><span>Photo Editor</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="code" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-code-assistant"></use></svg><span>Code Assistant</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="documents" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-documents"></use></svg><span>Documents</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="voice" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-voice-ai"></use></svg><span>Voice AI</span><em>NEXT</em>
        </button>

        <div class="nav-section-label">PERSONAL</div>
        <button class="nav-item" data-view="settings" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg><span>Settings</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <button class="profile" id="profileBtn" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-profile"></use></svg>
          <span><b>Athul</b><small>OZLIND User</small></span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <main class="main">
      <header class="topbar">
        <button class="icon-btn mobile-only" id="mobileNavBtn" type="button" aria-label="Open menu">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-menu"></use></svg>
        </button>
        <div class="topbar-title" id="topbarTitle">AI Chat</div>
        <div class="top-actions">
          <span class="connection" id="connectionStatus"><i></i><span>Ready</span></span>
          <button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme" title="Toggle theme">
            <svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg>
          </button>
        </div>
      </header>

      <section class="page active" data-page="chat">
        <div class="chat-head">
          <div class="hero-copy">
            <div class="eyebrow">PRIVATE AI WORKSPACE</div>
            <h1><span>How can I</span><strong>help?</strong></h1>
            <p>Clear answers, focused research and intelligent conversation.</p>
          </div>

          <div class="chat-controls">
            <div class="control-group">
              <span class="control-label">Model</span>
              <button class="model-picker" id="modelPicker" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="model-picker-main"><strong id="modelPickerTitle">Auto</strong><small id="modelPickerDescription">Recommended routing</small></span>
                <svg class="ui-icon"><use href="/ozlind-icons.svg#i-forward"></use></svg>
              </button>
              <select id="modelSelect" class="native-select-fallback" aria-hidden="true" tabindex="-1">
                <option value="auto">Auto</option>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
                <option value="experiential">Experiential</option>
              </select>
              <div class="model-menu" id="modelMenu" role="listbox" aria-label="Select model">
                <button type="button" role="option" data-model="auto" aria-selected="true"><span><b>Auto</b><small>Recommended routing</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="groq" aria-selected="false"><span><b>Groq</b><small>Fast text generation</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="gemini" aria-selected="false"><span><b>Gemini</b><small>Multimodal and vision</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="experiential" aria-selected="false"><span><b>Experiential</b><small>Alternative provider</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
              </div>
            </div>

            <button class="pill" id="researchToggle" type="button" aria-pressed="false">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-web-research"></use></svg><span>Research</span><strong>OFF</strong>
            </button>
          </div>
        </div>

        <div class="messages-wrap" id="messagesWrap">
          <div id="chatEmpty" class="empty-state">
            <div class="empty-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
            <div class="empty-kicker">OZLIND AI</div>
            <h2>Start a conversation</h2>
            <p>Ask a question, explore an idea, or work through a problem.</p>
            <div class="suggestions">
              <button data-prompt="Explain something simply." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-insight"></use></svg><span>Explain something</span></button>
              <button data-prompt="Help me plan something." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-discovery"></use></svg><span>Plan something</span></button>
              <button data-prompt="Write a clean JavaScript function for me." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-code-assistant"></use></svg><span>Write code</span></button>
              <button data-prompt="Create an image of a cinematic Kerala landscape at golden hour." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-image-generator"></use></svg><span>Create an image</span></button>
            </div>
          </div>
          <div id="chatMessages" class="messages" aria-live="polite"></div>
        </div>

        <form class="composer" id="chatForm" autocomplete="off">
          <div id="chatAttachments" class="attachments" aria-live="polite"></div>
          <div class="composer-row">
            <button type="button" class="composer-icon" id="attachBtn" aria-label="Attach image" title="Attach image">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-attach"></use></svg>
            </button>
            <input id="fileInput" type="file" accept="image/*" hidden>
            <textarea id="chatInput" rows="1" maxlength="12000" placeholder="Message OZLIND…" autocomplete="off" aria-label="Message OZLIND"></textarea>
            <button type="button" class="composer-icon voice-disabled" id="voiceBtn" aria-label="Voice input (coming soon)" title="Voice AI — NEXT">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-microphone"></use></svg>
            </button>
            <button type="submit" class="send-btn" id="sendBtn" aria-label="Send message" title="Send">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-arrow-up"></use></svg>
            </button>
            <button type="button" class="send-btn stop hidden" id="stopBtn" aria-label="Stop generation" title="Stop">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-stop"></use></svg>
            </button>
          </div>
          <div class="composer-footer">
            <span id="contextIndicator"></span>
            <span>Enter to send · Shift + Enter for new line</span>
          </div>
        </form>
      </section>

      <section class="page" data-page="history">
        <div class="page-head"><div><div class="eyebrow">PERSONAL</div><h2>Conversation history</h2><p>Your conversations stay in this browser.</p></div></div>
        <div class="search-wrap"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-search"></use></svg><input class="search" id="conversationSearch" placeholder="Search conversations…" aria-label="Search conversations"></div>
        <div id="conversationList" class="history-list"></div>
      </section>

      <section class="page" data-page="research">
        <div class="page-head"><div><div class="eyebrow">LIVE SOURCES</div><h2>Web Research</h2><p>Research current information when freshness matters.</p></div><button class="btn btn-primary" data-focus-chat type="button">Open chat</button></div>
        <div class="info-card"><div class="card-icon"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-research"></use></svg></div><div><b>Source-aware research</b><p>OZLIND can search the web through Tavily on the server, then synthesize the returned source context. API keys never live in this page.</p></div></div>
      </section>

      <section class="page" data-page="photo"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Photo Editor</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="code"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Code Assistant</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="documents"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Documents</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="voice"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Voice AI</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>

      <section class="page" data-page="settings">
        <div class="page-head"><div><div class="eyebrow">PERSONAL</div><h2>Settings</h2><p>Control response behavior and local data.</p></div></div>
        <div class="settings-grid">
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">RESPONSE</span><h3>Answer preferences</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-insight"></use></svg></div>
            <label class="setting-row"><span>Length</span><select id="responseLength"><option value="short">Short</option><option value="medium" selected>Medium</option><option value="long">Long</option></select></label>
            <label class="setting-row"><span>Style</span><select id="responseStyle"><option value="balanced" selected>Balanced</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="direct">Direct</option><option value="creative">Creative</option></select></label>
            <button class="switch-row" id="memoryToggle" role="switch" aria-checked="true" type="button"><span><b>Conversation memory</b><small>Use relevant messages from this conversation.</small></span><i></i></button>
          </div>
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">PREFERENCES</span><h3>Custom instructions</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg></div>
            <textarea id="customInstructions" maxlength="5000" placeholder="Tell OZLIND how you prefer answers…"></textarea>
            <button class="btn btn-primary" id="saveInstructionsBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg><span>Save settings</span></button>
          </div>
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">LOCAL DATA</span><h3>History controls</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#i-history"></use></svg></div>
            <div class="button-stack">
              <button class="btn" id="exportHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-download"></use></svg><span>Export history</span></button>
              <button class="btn" id="importHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-upload"></use></svg><span>Import history</span></button>
              <button class="btn btn-danger" id="clearHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-delete"></use></svg><span>Clear all history</span></button>
            </div>
            <input type="file" id="historyFileInput" accept="application/json" hidden>
          </div>
        </div>
      </section>
    </main>
  </div>

  <div id="toastStack" class="toast-stack" aria-live="polite"></div>
`;


export default function Home() {
  useEffect(() => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    const STORAGE = {
      conversations: "ozlind.conversations.v1",
      settings: "ozlind.settings.v1",
      theme: "ozlind.theme.v1",
    };

    const state = {
      view: "chat",
      model: localStorage.getItem("ozlind.model") || "auto",
      research: false,
      memory: true,
      responseLength: "medium",
      responseStyle: "balanced",
      customInstructions: "",
      conversations: [],
      activeConversationId: null,
      messages: [],
      attachments: [],
      busy: false,
      controller: null,
      provider: null,
      modelUsed: null,
      requestId: 0,
    };

    const safeJson = (value, fallback) => {
      try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
      } catch {
        return fallback;
      }
    };

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const renderText = (value) => {
      let text = escapeHtml(value);
      const blocks = [];
      text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
        const index = blocks.push(`<pre class="message-code"><code>${code.trim()}</code></pre>`) - 1;
        return `@@CODE_${index}@@`;
      });
      text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
      text = text.replace(/(^|\n)###\s+(.+)/g, "$1<h4>$2</h4>");
      text = text.replace(/(^|\n)##\s+(.+)/g, "$1<h3>$2</h3>");
      text = text.replace(/(^|\n)#\s+(.+)/g, "$1<h2>$2</h2>");
      text = text.replace(/(^|\n)[•*-]\s+(.+)/g, "$1<span class=\"message-list-item\">• $2</span>");
      text = text.replace(/\n/g, "<br>");
      blocks.forEach((block, index) => {
        text = text.replace(`@@CODE_${index}@@`, block);
      });
      return text;
    };

    const uid = () =>
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    const save = () => {
      localStorage.setItem(STORAGE.conversations, JSON.stringify(state.conversations.slice(0, 50)));
    };

    const load = () => {
      state.conversations = safeJson(localStorage.getItem(STORAGE.conversations), []);
      if (!Array.isArray(state.conversations)) state.conversations = [];

      const settings = safeJson(localStorage.getItem(STORAGE.settings), {});
      if (settings && typeof settings === "object") {
        state.memory = settings.memory !== false;
        state.responseLength = ["short", "medium", "long"].includes(settings.responseLength)
          ? settings.responseLength : "medium";
        state.responseStyle = ["balanced", "professional", "friendly", "direct", "creative"].includes(settings.responseStyle)
          ? settings.responseStyle : "balanced";
        state.customInstructions = typeof settings.customInstructions === "string"
          ? settings.customInstructions.slice(0, 5000) : "";
      }
    };

    const toast = (message, kind = "info") => {
      const stack = $("#toastStack");
      if (!stack) return;
      const item = document.createElement("div");
      item.className = `toast toast-${kind}`;
      item.textContent = message;
      stack.appendChild(item);
      window.setTimeout(() => item.classList.add("is-visible"), 10);
      window.setTimeout(() => {
        item.classList.remove("is-visible");
        window.setTimeout(() => item.remove(), 220);
      }, 2800);
    };

    const setConnection = (text, busy = false) => {
      const el = $("#connectionStatus");
      if (!el) return;
      const label = $("span:last-child", el);
      if (label) label.textContent = text;
      el.classList.toggle("is-busy", busy);
    };

    const updateContextIndicator = () => {
      const el = $("#contextIndicator");
      if (!el) return;
      const count = state.messages.filter(m => m.role === "user" || m.role === "assistant").length;
      el.textContent = count ? `${count} message${count === 1 ? "" : "s"} in context` : "";
    };

    const titleFromText = (text) => {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (!clean) return "New conversation";
      return clean.length > 52 ? `${clean.slice(0, 52).trim()}…` : clean;
    };

    const currentConversation = () =>
      state.conversations.find(c => c.id === state.activeConversationId) || null;

    const saveActiveConversation = () => {
      if (!state.messages.length && !state.activeConversationId) return;
      let conversation = currentConversation();

      if (!conversation) {
        const firstUser = state.messages.find(m => m.role === "user");
        conversation = {
          id: state.activeConversationId || uid(),
          title: titleFromText(firstUser?.text || "New conversation"),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };
        state.activeConversationId = conversation.id;
        state.conversations.unshift(conversation);
      }

      conversation.messages = state.messages.map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        image: m.image || null,
        sources: m.sources || [],
        createdAt: m.createdAt || Date.now(),
      }));
      conversation.updatedAt = Date.now();
      save();
      renderHistory();
    };

    const renderHistory = (query = "") => {
      const list = $("#conversationList");
      if (!list) return;
      const q = query.trim().toLowerCase();
      const items = state.conversations
        .filter(c => !q || c.title.toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      if (!items.length) {
        list.innerHTML = `<div class="empty-state compact"><h3>No conversations yet</h3><p>Your saved conversations will appear here.</p></div>`;
        return;
      }

      list.innerHTML = items.map(c => `
        <button class="history-item ${c.id === state.activeConversationId ? "active" : ""}" data-conversation-id="${escapeHtml(c.id)}" type="button">
          <span class="history-item-main">
            <b>${escapeHtml(c.title)}</b>
            <small>${new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleDateString()}</small>
          </span>
          <span class="history-item-arrow">›</span>
        </button>
      `).join("");

      $$(".history-item", list).forEach(btn => {
        btn.addEventListener("click", () => loadConversation(btn.dataset.conversationId));
      });
    };

    const renderAttachments = () => {
      const wrap = $("#chatAttachments");
      if (!wrap) return;
      wrap.innerHTML = state.attachments.map((item, index) => `
        <div class="attachment-chip">
          <img src="${item.dataUrl}" alt="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.name)}</span>
          <button type="button" data-remove-attachment="${index}" aria-label="Remove image">×</button>
        </div>
      `).join("");

      $$("[data-remove-attachment]", wrap).forEach(btn => {
        btn.addEventListener("click", () => {
          state.attachments.splice(Number(btn.dataset.removeAttachment), 1);
          renderAttachments();
        });
      });
    };

    const renderMessages = () => {
      const empty = $("#chatEmpty");
      const wrap = $("#chatMessages");
      if (!wrap) return;

      empty?.classList.toggle("hidden", state.messages.length > 0);

      wrap.innerHTML = state.messages.map(message => {
        const isUser = message.role === "user";
        const sources = Array.isArray(message.sources) && message.sources.length
          ? `<div class="message-sources">
              <div class="sources-label">Sources</div>
              ${message.sources.map(source => `
                <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
                  <span>${escapeHtml(source.title || source.domain || "Source")}</span>
                  <small>${escapeHtml(source.domain || "")}</small>
                </a>
              `).join("")}
            </div>` : "";

        const image = message.image
          ? `<img class="message-image" src="${message.image}" alt="Attached image">`
          : "";

        return `
          <article class="message ${isUser ? "message-user" : "message-assistant"}" data-message-id="${escapeHtml(message.id)}">
            <div class="message-avatar">${isUser ? "A" : `<svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg>`}</div>
            <div class="message-body">
              <div class="message-meta"><b>${isUser ? "You" : "OZLIND"}</b></div>
              ${image}
              <div class="message-content">${renderText(message.text || "")}</div>
              ${sources}
              <div class="message-actions">
                <button type="button" data-action="copy">Copy</button>
                ${!isUser ? `<button type="button" data-action="regenerate">Regenerate</button>` : `<button type="button" data-action="edit">Edit</button>`}
                <button type="button" data-action="delete">Delete</button>
              </div>
            </div>
          </article>
        `;
      }).join("");

      $$("[data-action]", wrap).forEach(btn => {
        btn.addEventListener("click", () => handleMessageAction(btn));
      });

      wrap.scrollTop = wrap.scrollHeight;
      updateContextIndicator();
    };

    const addMessage = (role, text, extra = {}) => {
      const message = {
        id: uid(),
        role,
        text: String(text || ""),
        createdAt: Date.now(),
        ...extra,
      };
      state.messages.push(message);
      renderMessages();
      return message;
    };

    const updateMessage = (id, patch) => {
      const message = state.messages.find(m => m.id === id);
      if (!message) return;
      Object.assign(message, patch);
      renderMessages();
    };

    const deleteMessage = (id) => {
      const index = state.messages.findIndex(m => m.id === id);
      if (index === -1) return;
      state.messages.splice(index, 1);
      renderMessages();
      saveActiveConversation();
    };

    const handleMessageAction = async (button) => {
      const article = button.closest("[data-message-id]");
      if (!article) return;
      const id = article.dataset.messageId;
      const message = state.messages.find(m => m.id === id);
      if (!message) return;

      const action = button.dataset.action;

      if (action === "copy") {
        try {
          await navigator.clipboard.writeText(message.text || "");
          toast("Copied to clipboard", "success");
        } catch {
          toast("Copy failed", "error");
        }
        return;
      }

      if (action === "delete") {
        deleteMessage(id);
        return;
      }

      if (action === "edit" && message.role === "user") {
        const input = $("#chatInput");
        if (!input) return;
        input.value = message.text || "";
        const index = state.messages.findIndex(m => m.id === id);
        state.messages = state.messages.slice(0, index);
        renderMessages();
        input.focus();
        input.dispatchEvent(new Event("input"));
        return;
      }

      if (action === "regenerate" && message.role === "assistant" && !state.busy) {
        const index = state.messages.findIndex(m => m.id === id);
        if (index <= 0) return;
        const previousUser = [...state.messages.slice(0, index)].reverse().find(m => m.role === "user");
        if (!previousUser) return;
        state.messages = state.messages.slice(0, index);
        renderMessages();
        await sendMessage(previousUser.text, { regenerate: true });
      }
    };

    const loadConversation = (id) => {
      const conversation = state.conversations.find(c => c.id === id);
      if (!conversation) return;
      state.activeConversationId = conversation.id;
      state.messages = Array.isArray(conversation.messages)
        ? conversation.messages.map(m => ({ ...m }))
        : [];
      showView("chat");
      renderMessages();
      renderHistory($("#conversationSearch")?.value || "");
    };

    const newChat = () => {
      if (state.busy) {
        state.controller?.abort();
        state.busy = false;
      }
      state.activeConversationId = null;
      state.messages = [];
      state.attachments = [];
      state.provider = null;
      state.modelUsed = null;
      renderAttachments();
      renderMessages();
      setConnection("Ready", false);
      const input = $("#chatInput");
      if (input) {
        input.value = "";
        input.focus();
      }
    };

    const showView = (view) => {
      const allowed = ["chat", "history", "research", "photo", "code", "documents", "voice", "settings"];
      state.view = allowed.includes(view) ? view : "chat";

      $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === state.view));
      $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === state.view));

      const titles = {
        chat: "AI Chat",
        history: "History",
        research: "Web Research",
        photo: "Photo Editor",
        code: "Code Assistant",
        documents: "Documents",
        voice: "Voice AI",
        settings: "Settings",
      };
      const topbarTitle = $("#topbarTitle");
      if (topbarTitle) topbarTitle.textContent = titles[state.view];

      $("#sidebar")?.classList.remove("open");
      $("#sidebarOverlay")?.classList.remove("open");
      if (state.view === "history") renderHistory($("#conversationSearch")?.value || "");
    };

    const updateModelUI = () => {
      const descriptions = {
        auto: ["Auto", "Recommended routing"],
        groq: ["Groq", "Fast text generation"],
        gemini: ["Gemini", "Multimodal and vision"],
        experiential: ["Experiential", "Alternative provider"],
      };
      const [title, description] = descriptions[state.model] || descriptions.auto;
      if ($("#modelPickerTitle")) $("#modelPickerTitle").textContent = title;
      if ($("#modelPickerDescription")) $("#modelPickerDescription").textContent = description;
      const select = $("#modelSelect");
      if (select) select.value = state.model;

      $$("#modelMenu [data-model]").forEach(item => {
        const selected = item.dataset.model === state.model;
        item.setAttribute("aria-selected", String(selected));
        item.classList.toggle("selected", selected);
      });
    };

    const updateResearchUI = () => {
      const button = $("#researchToggle");
      if (!button) return;
      button.setAttribute("aria-pressed", String(state.research));
      const status = $("strong", button);
      if (status) status.textContent = state.research ? "ON" : "OFF";
      button.classList.toggle("active", state.research);
    };

    const updateSettingsUI = () => {
      const length = $("#responseLength");
      const style = $("#responseStyle");
      const memory = $("#memoryToggle");
      const instructions = $("#customInstructions");

      if (length) length.value = state.responseLength;
      if (style) style.value = state.responseStyle;
      if (instructions) instructions.value = state.customInstructions;
      if (memory) {
        memory.setAttribute("aria-checked", String(state.memory));
        memory.classList.toggle("active", state.memory);
      }
    };

    const persistSettings = () => {
      localStorage.setItem(STORAGE.settings, JSON.stringify({
        memory: state.memory,
        responseLength: state.responseLength,
        responseStyle: state.responseStyle,
        customInstructions: state.customInstructions,
      }));
    };

    const toDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const buildApiMessages = () => state.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map(m => {
        if (m.image && m.role === "user") {
          return {
            role: "user",
            content: [
              { type: "text", text: m.text || "Please analyze this image." },
              { type: "image_url", image_url: { url: m.image } },
            ],
          };
        }
        return { role: m.role, content: m.text || "" };
      });

    const parseSse = async (response, onEvent) => {
      if (!response.body) throw new Error("The AI service returned no stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            await onEvent(JSON.parse(raw));
          } catch {
            // Ignore malformed SSE frames.
          }
        }
      }

      if (buffer.startsWith("data:")) {
        const raw = buffer.slice(5).trim();
        if (raw) {
          try { await onEvent(JSON.parse(raw)); } catch {}
        }
      }
    };

    const sendMessage = async (text, options = {}) => {
      const clean = String(text || "").trim();
      if ((!clean && !state.attachments.length) || state.busy) return;

      const attached = state.attachments[0] || null;
      state.attachments = [];
      renderAttachments();

      const userMessage = addMessage("user", clean || "Please analyze this image.", {
        image: attached?.dataUrl || null,
      });

      if (!options.regenerate) saveActiveConversation();

      const assistant = addMessage("assistant", "");
      const requestId = ++state.requestId;

      state.busy = true;
      state.provider = null;
      state.modelUsed = null;
      state.controller = new AbortController();

      $("#sendBtn")?.classList.add("hidden");
      $("#stopBtn")?.classList.remove("hidden");
      setConnection("Thinking…", true);

      try {
        const payload = {
          messages: buildApiMessages(),
          model: state.model,
          mode: state.model,
          research: state.research,
          memory: state.memory,
          responseLength: state.responseLength,
          responseStyle: state.responseStyle,
          customInstructions: state.customInstructions,
          conversationId: state.activeConversationId || undefined,
          visitorId: localStorage.getItem("ozlind.visitorId") || (() => {
            const id = uid();
            localStorage.setItem("ozlind.visitorId", id);
            return id;
          })(),
        };

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(payload),
          signal: state.controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${response.status}).`);
        }

        await parseSse(response, async event => {
          if (requestId !== state.requestId) return;

          if (event.type === "delta") {
            assistant.text += String(event.content || "");
            renderMessages();
          } else if (event.type === "provider") {
            state.provider = event.provider || null;
            state.modelUsed = event.model || null;
          } else if (event.type === "sources") {
            assistant.sources = Array.isArray(event.sources) ? event.sources : [];
            renderMessages();
          } else if (event.type === "conversation" && event.conversationId) {
            state.activeConversationId = event.conversationId;
          } else if (event.type === "error") {
            throw new Error(event.error || "The AI service returned an error.");
          }
        });

        if (!assistant.text.trim()) {
          throw new Error("OZLIND returned an empty response. Please try again.");
        }

        saveActiveConversation();
        setConnection("Ready", false);
      } catch (error) {
        if (error?.name === "AbortError") {
          if (!assistant.text.trim()) {
            deleteMessage(assistant.id);
          }
          setConnection("Stopped", false);
        } else {
          deleteMessage(assistant.id);
          setConnection("Ready", false);
          toast(error?.message || "Unable to complete the request.", "error");
        }
      } finally {
        if (requestId === state.requestId) {
          state.busy = false;
          state.controller = null;
          $("#sendBtn")?.classList.remove("hidden");
          $("#stopBtn")?.classList.add("hidden");
          updateContextIndicator();
        }
      }
    };

    const stopGeneration = () => {
      if (!state.busy) return;
      state.controller?.abort();
    };

    const exportHistory = () => {
      const blob = new Blob([JSON.stringify(state.conversations, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ozlind-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const importHistory = async (file) => {
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error("Invalid history file.");
        state.conversations = imported
          .filter(c => c && typeof c === "object" && typeof c.id === "string")
          .slice(0, 50);
        save();
        renderHistory();
        toast("History imported", "success");
      } catch {
        toast("Could not import that history file.", "error");
      }
    };

    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem(STORAGE.theme, theme);
    };

    load();

    const savedTheme = localStorage.getItem(STORAGE.theme);
    if (savedTheme === "light" || savedTheme === "dark") {
      applyTheme(savedTheme);
    }

    updateModelUI();
    updateResearchUI();
    updateSettingsUI();
    renderHistory();
    renderMessages();
    renderAttachments();

    // Boot experience.
    const boot = $("#ozlindBoot");
    if (boot) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const delay = reduced ? 420 : 1050;
      const leave = window.setTimeout(() => {
        boot.classList.add("is-leaving");
        window.setTimeout(() => boot.remove(), 520);
      }, delay);
      const fallback = window.setTimeout(() => boot.remove(), 3000);
      void leave;
      void fallback;
    }

    // Navigation.
    $$(".nav-item[data-view]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.classList.contains("disabled-tool")) {
          toast("This tool is coming next.", "info");
          return;
        }
        showView(button.dataset.view);
      });
    });

    $("#newChatBtn")?.addEventListener("click", newChat);
    $("#profileBtn")?.addEventListener("click", () => showView("settings"));
    $("#mobileNavBtn")?.addEventListener("click", () => {
      $("#sidebar")?.classList.add("open");
      $("#sidebarOverlay")?.classList.add("open");
    });
    $("#sidebarOverlay")?.addEventListener("click", () => {
      $("#sidebar")?.classList.remove("open");
      $("#sidebarOverlay")?.classList.remove("open");
    });

    $$("[data-focus-chat]").forEach(button => {
      button.addEventListener("click", () => {
        showView("chat");
        $("#chatInput")?.focus();
      });
    });

    // Model picker.
    $("#modelPicker")?.addEventListener("click", () => {
      const menu = $("#modelMenu");
      if (!menu) return;
      const open = menu.classList.toggle("open");
      $("#modelPicker")?.setAttribute("aria-expanded", String(open));
    });

    $$("#modelMenu [data-model]").forEach(button => {
      button.addEventListener("click", () => {
        state.model = button.dataset.model || "auto";
        localStorage.setItem("ozlind.model", state.model);
        updateModelUI();
        $("#modelMenu")?.classList.remove("open");
        $("#modelPicker")?.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", event => {
      const picker = $("#modelPicker");
      const menu = $("#modelMenu");
      if (picker && menu && !picker.contains(event.target) && !menu.contains(event.target)) {
        menu.classList.remove("open");
        picker.setAttribute("aria-expanded", "false");
      }
    });

    $("#modelSelect")?.addEventListener("change", event => {
      state.model = event.target.value || "auto";
      localStorage.setItem("ozlind.model", state.model);
      updateModelUI();
    });

    $("#researchToggle")?.addEventListener("click", () => {
      state.research = !state.research;
      updateResearchUI();
    });

    // Composer.
    $("#chatForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const input = $("#chatInput");
      sendMessage(input?.value || "").then(() => {
        if (input) input.value = "";
      });
    });

    $("#chatInput")?.addEventListener("input", event => {
      const input = event.target;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    });

    $("#chatInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("#chatForm")?.requestSubmit();
      }
    });

    $("#stopBtn")?.addEventListener("click", stopGeneration);

    // Suggestions.
    $$("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        const input = $("#chatInput");
        if (!input) return;
        input.value = button.dataset.prompt || "";
        input.focus();
        input.dispatchEvent(new Event("input"));
      });
    });

    // Attachments.
    $("#attachBtn")?.addEventListener("click", () => $("#fileInput")?.click());
    $("#fileInput")?.addEventListener("change", async event => {
      const files = [...(event.target.files || [])];
      const file = files[0];
      event.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast("Please select an image.", "error");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast("Image must be smaller than 8 MB.", "error");
        return;
      }

      try {
        const dataUrl = await toDataUrl(file);
        state.attachments = [{ name: file.name, dataUrl }];
        renderAttachments();
      } catch {
        toast("Could not read that image.", "error");
      }
    });

    // History.
    $("#conversationSearch")?.addEventListener("input", event => renderHistory(event.target.value));
    $("#exportHistoryBtn")?.addEventListener("click", exportHistory);
    $("#importHistoryBtn")?.addEventListener("click", () => $("#historyFileInput")?.click());
    $("#historyFileInput")?.addEventListener("change", event => {
      importHistory(event.target.files?.[0]);
      event.target.value = "";
    });

    $("#clearHistoryBtn")?.addEventListener("click", () => {
      if (!window.confirm("Clear all saved conversations from this browser?")) return;
      state.conversations = [];
      state.activeConversationId = null;
      save();
      renderHistory();
      toast("History cleared", "success");
    });

    // Settings.
    $("#responseLength")?.addEventListener("change", event => {
      state.responseLength = event.target.value;
      persistSettings();
    });

    $("#responseStyle")?.addEventListener("change", event => {
      state.responseStyle = event.target.value;
      persistSettings();
    });

    $("#memoryToggle")?.addEventListener("click", () => {
      state.memory = !state.memory;
      updateSettingsUI();
      persistSettings();
    });

    $("#customInstructions")?.addEventListener("input", event => {
      state.customInstructions = event.target.value.slice(0, 5000);
    });

    $("#saveInstructionsBtn")?.addEventListener("click", () => {
      state.customInstructions = $("#customInstructions")?.value?.slice(0, 5000) || "";
      persistSettings();
      toast("Settings saved", "success");
    });

    // Theme button.
    $("#themeToggle")?.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current === "light" ? "dark" : "light");
    });

    // Close menus on Escape.
    const onKeydown = event => {
      if (event.key === "Escape") {
        $("#modelMenu")?.classList.remove("open");
        $("#modelPicker")?.setAttribute("aria-expanded", "false");
        $("#sidebar")?.classList.remove("open");
        $("#sidebarOverlay")?.classList.remove("open");
      }
    };
    document.addEventListener("keydown", onKeydown);

    return () => {
      state.controller?.abort();
      document.removeEventListener("keydown", onKeydown);
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
