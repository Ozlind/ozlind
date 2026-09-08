/* =========================================================
   OZLIND — chatbot.js
   App shell + AI Chat + History + Settings
   ========================================================= */

(() => {
  "use strict";

  const STORAGE = {
    conversations: "ozlind:conversations",
    theme: "ozlind:theme",
    memory: "ozlind:memory",
    instructions: "ozlind:customInstructions",
    responseLength: "ozlind:responseLength",
    responseStyle: "ozlind:responseStyle"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const app = $("#app");
  const sidebar = $("#sidebar");
  const sidebarOverlay = $("#sidebarOverlay");
  const topbarTitle = $("#topbarTitle");

  const chatMessages = $("#chatMessages");
  const chatEmpty = $("#chatEmpty");
  const chatForm = $("#chatForm");
  const chatInput = $("#chatInput");
  const sendBtn = $("#sendBtn");
  const stopBtn = $("#stopBtn");

  const conversationList = $("#conversationList");
  const conversationSearch = $("#conversationSearch");
  const chatHistoryPanel = $("#chatHistoryPanel");

  const modelSelect = $("#modelSelect");
  const researchToggle = $("#researchToggle");

  const fileInput = $("#fileInput");
  const attachBtn = $("#attachBtn");
  const chatAttachments = $("#chatAttachments");

  let conversations = loadJSON(STORAGE.conversations, []);
  let activeId = conversations[0]?.id || null;
  let pendingAttachments = [];
  let abortController = null;
  let isGenerating = false;

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (!value) return fallback;
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Unable to save local data.", true);
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
  }

  /* =========================
     NAVIGATION
  ========================== */

  const titles = {
    home: "Home",
    chat: "AI Chat",
    editor: "Image Editor",
    history: "History",
    settings: "Settings"
  };

  function switchView(view) {
    if (!titles[view]) return;

    $$(".view").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.view === view);
    });

    $$(".nav__item[data-view]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.view === view);
    });

    topbarTitle.textContent = titles[view];

    closeMobileSidebar();

    if (view === "history") {
      renderHistoryPage();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-view]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      const view = element.dataset.view;
      if (view) switchView(view);
    });
  });

  /* =========================
     MOBILE SIDEBAR
  ========================== */

  $("#mobileNavBtn")?.addEventListener("click", () => {
    sidebar.classList.add("is-open");
    sidebarOverlay.classList.add("is-open");
  });

  function closeMobileSidebar() {
    sidebar.classList.remove("is-open");
    sidebarOverlay.classList.remove("is-open");
  }

  sidebarOverlay?.addEventListener("click", closeMobileSidebar);

  $("#collapseBtn")?.addEventListener("click", () => {
    app.classList.toggle("sidebar-collapsed");
  });

  /* =========================
     THEME
  ========================== */

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme, persist = true) {
    const actual = theme === "system" ? systemTheme() : theme;

    document.body.dataset.theme = actual;

    if (persist) {
      localStorage.setItem(STORAGE.theme, theme);
    }

    $$("[data-theme-value]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.themeValue === theme);
    });
  }

  function currentThemePreference() {
    return localStorage.getItem(STORAGE.theme) || "dark";
  }

  function toggleTheme() {
    const current = document.body.dataset.theme || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  $("#themeToggleDesktop")?.addEventListener("click", toggleTheme);
  $("#themeToggleMobile")?.addEventListener("click", toggleTheme);

  $("#settingsThemeGroup")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-value]");
    if (!button) return;
    applyTheme(button.dataset.themeValue);
  });

  window.matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (currentThemePreference() === "system") {
        applyTheme("system", false);
      }
    });

  applyTheme(currentThemePreference(), false);

  /* =========================
     CONVERSATIONS
  ========================== */

  function createConversation() {
    const conversation = {
      id: crypto.randomUUID(),
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };

    conversations.unshift(conversation);
    activeId = conversation.id;
    saveJSON(STORAGE.conversations, conversations);

    return conversation;
  }

  function getActiveConversation() {
    return conversations.find((item) => item.id === activeId) || null;
  }

  function saveConversations() {
    saveJSON(STORAGE.conversations, conversations);
  }

  function ensureConversation() {
    return getActiveConversation() || createConversation();
  }

  function newChat() {
    createConversation();
    pendingAttachments = [];
    renderAttachments();
    renderConversationList();
    renderMessages();

    switchView("chat");
    chatInput.focus();
  }

  $("#newChatBtn")?.addEventListener("click", newChat);

  function makeTitle(text) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return "New conversation";

    const firstSentence = cleaned.split(/[.!?\n]/)[0].trim();

    if (firstSentence.length <= 42) {
      return firstSentence;
    }

    return `${firstSentence.slice(0, 39)}…`;
  }

  function updateConversationMeta(conversation) {
    const firstUserMessage = conversation.messages.find(
      (message) => message.role === "user"
    );

    if (
      firstUserMessage &&
      (!conversation.title || conversation.title === "New conversation")
    ) {
      conversation.title = makeTitle(firstUserMessage.content);
    }

    conversation.updatedAt = Date.now();
    saveConversations();
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(timestamp);
  }

  function renderConversationList(filter = "") {
    if (!conversationList) return;

    const query = filter.trim().toLowerCase();

    const visible = conversations.filter((conversation) => {
      if (!query) return true;

      return (
        conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some((message) =>
          String(message.content || "").toLowerCase().includes(query)
        )
      );
    });

    if (!visible.length) {
      conversationList.innerHTML = `
        <div class="page-empty" style="margin:35px 10px">
          <h3 style="font-size:11px">No conversations</h3>
          <p style="font-size:9px">Start a new chat.</p>
        </div>
      `;
      return;
    }

    conversationList.innerHTML = visible.map((conversation) => `
      <div
        class="conversation-row ${conversation.id === activeId ? "is-active" : ""}"
        data-id="${escapeAttr(conversation.id)}"
      >
        <button class="conversation-open" type="button">
          <strong>${escapeHTML(conversation.title)}</strong>
          <small>${formatDate(conversation.updatedAt)}</small>
        </button>

        <button
          class="conversation-delete"
          type="button"
          aria-label="Delete conversation"
          title="Delete conversation"
        >
          ×
        </button>
      </div>
    `).join("");
  }

  conversationList?.addEventListener("click", (event) => {
    const row = event.target.closest(".conversation-row");
    if (!row) return;

    const id = row.dataset.id;

    if (event.target.closest(".conversation-delete")) {
      deleteConversation(id);
      return;
    }

    activeId = id;
    renderConversationList(conversationSearch?.value || "");
    renderMessages();
  });

  conversationSearch?.addEventListener("input", () => {
    renderConversationList(conversationSearch.value);
  });

  function deleteConversation(id) {
    const index = conversations.findIndex((item) => item.id === id);
    if (index === -1) return;

    conversations.splice(index, 1);

    if (activeId === id) {
      activeId = conversations[0]?.id || null;
    }

    saveConversations();
    renderConversationList();
    renderMessages();
    renderHistoryPage();

    toast("Conversation deleted.");
  }

  /* =========================
     HISTORY PAGE
  ========================== */

  function renderHistoryPage() {
    const list = $("#historyPageList");
    const empty = $("#historyEmpty");

    if (!list || !empty) return;

    if (!conversations.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = conversations.map((conversation) => `
      <div class="history-page-item">
        <div class="history-page-item__body">
          <strong>${escapeHTML(conversation.title)}</strong>
          <small>
            ${conversation.messages.length} messages ·
            ${formatDate(conversation.updatedAt)}
          </small>
        </div>

        <button
          class="btn"
          type="button"
          data-history-open="${escapeAttr(conversation.id)}"
        >
          Open
        </button>

        <button
          class="icon-btn"
          type="button"
          data-history-delete="${escapeAttr(conversation.id)}"
          aria-label="Delete"
        >
          ×
        </button>
      </div>
    `).join("");
  }

  $("#historyPageList")?.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-history-open]");
    const deleteButton = event.target.closest("[data-history-delete]");

    if (openButton) {
      activeId = openButton.dataset.historyOpen;
      renderConversationList();
      renderMessages();
      switchView("chat");
      return;
    }

    if (deleteButton) {
      deleteConversation(deleteButton.dataset.historyDelete);
    }
  });

  /* =========================
     MARKDOWN
  ========================== */

  function renderMarkdownSafe(markdown) {
    let text = escapeHTML(markdown);

    const codeBlocks = [];

    text = text.replace(
      /```([\w+-]*)\n?([\s\S]*?)```/g,
      (_, language, code) => {
        const id = `code-${codeBlocks.length}`;

        codeBlocks.push({
          id,
          language: language || "code",
          code: code.trim()
        });

        return `@@CODE_${codeBlocks.length - 1}@@`;
      }
    );

    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");

    text = text.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    text = text.replace(
      /(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g,
      "$1<em>$2</em>"
    );

    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) =>
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );

    text = text.replace(
      /^(?:[-*]) (.+)$/gm,
      "<li>$1</li>"
    );

    text = text.replace(
      /(?:<li>.*<\/li>\n?)+/g,
      (block) => `<ul>${block}</ul>`
    );

    text = text.replace(
      /^(\d+)\. (.+)$/gm,
      "<li>$2</li>"
    );

    text = text.replace(/\n{2,}/g, "</p><p>");
    text = text.replace(/\n/g, "<br>");

    text = `<p>${text}</p>`;

    text = text.replace(
      /<p>(@@CODE_(\d+)@@)<\/p>/g,
      "$1"
    );

    text = text.replace(
      /@@CODE_(\d+)@@/g,
      (_, index) => {
        const block = codeBlocks[Number(index)];

        return `
          <div class="code-block">
            <div class="code-block__head">
              <span>${escapeHTML(block.language)}</span>
              <button
                class="code-copy"
                type="button"
                data-code="${escapeAttr(block.code)}"
              >
                Copy
              </button>
            </div>
            <pre><code>${escapeHTML(block.code)}</code></pre>
          </div>
        `;
      }
    );

    return text;
  }

  /* =========================
     MESSAGE RENDERING
  ========================== */

  function renderMessages() {
    const conversation = getActiveConversation();

    if (!chatMessages || !chatEmpty) return;

    if (!conversation || !conversation.messages.length) {
      chatMessages.innerHTML = "";
      chatEmpty.hidden = false;
      return;
    }

    chatEmpty.hidden = true;

    chatMessages.innerHTML = conversation.messages.map((message, index) => {
      const isUser = message.role === "user";
      const content = isUser
        ? escapeHTML(message.content).replace(/\n/g, "<br>")
        : renderMarkdownSafe(message.content);

      const sources = Array.isArray(message.sources)
        ? message.sources
        : [];

      return `
        <article class="msg ${isUser ? "msg--user" : "msg--assistant"}">
          <div class="msg__avatar">
            ${isUser ? "You" : "O"}
          </div>

          <div class="msg__content">

            <div class="msg__role">
              ${isUser ? "You" : "OZLIND AI"}
            </div>

            <div class="msg__body">
              ${content || ""}
            </div>

            ${
              message.researched
                ? `
                  <div class="msg__research">
                    <span class="status-dot"></span>
                    Researched · ${sources.length} source${sources.length === 1 ? "" : "s"}
                  </div>
                `
                : ""
            }

            ${
              sources.length
                ? `
                  <details class="msg__sources">
                    <summary>Sources</summary>

                    ${sources.map((source) => `
                      <a
                        class="source-item"
                        href="${escapeAttr(source.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ${escapeHTML(source.title || source.url)}
                        <small>${escapeHTML(source.domain || "")}</small>
                      </a>
                    `).join("")}
                  </details>
                `
                : ""
            }

            ${
              !isUser
                ? `
                  <div class="msg__actions">
                    <button class="msg-action" type="button" data-action="copy" data-index="${index}" title="Copy">⧉</button>
                    <button class="msg-action" type="button" data-action="regenerate" data-index="${index}" title="Regenerate">↻</button>
                    <button class="msg-action" type="button" data-action="like" data-index="${index}" title="Good response">♡</button>
                    <button class="msg-action" type="button" data-action="dislike" data-index="${index}" title="Poor response">♧</button>
                    <button class="msg-action" type="button" data-action="edit" data-index="${index}" title="Edit">✎</button>
                    <button class="msg-action" type="button" data-action="delete" data-index="${index}" title="Delete">×</button>
                  </div>
                `
                : `
                  <div class="msg__actions">
                    <button class="msg-action" type="button" data-action="copy" data-index="${index}" title="Copy">⧉</button>
                    <button class="msg-action" type="button" data-action="edit" data-index="${index}" title="Edit">✎</button>
                    <button class="msg-action" type="button" data-action="delete" data-index="${index}" title="Delete">×</button>
                  </div>
                `
            }

          </div>
        </article>
      `;
    }).join("");

    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  chatMessages?.addEventListener("click", async (event) => {
    const codeCopy = event.target.closest(".code-copy");

    if (codeCopy) {
      try {
        await navigator.clipboard.writeText(codeCopy.dataset.code || "");
        codeCopy.textContent = "Copied";
        setTimeout(() => {
          codeCopy.textContent = "Copy";
        }, 1200);
      } catch {
        toast("Could not copy code.", true);
      }
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const conversation = getActiveConversation();
    if (!conversation) return;

    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    const message = conversation.messages[index];

    if (!message) return;

    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(message.content || "");
        toast("Copied to clipboard.");
      } catch {
        toast("Could not copy the message.", true);
      }
      return;
    }

    if (action === "delete") {
      conversation.messages.splice(index, 1);
      updateConversationMeta(conversation);
      renderMessages();
      renderConversationList();
      return;
    }

    if (action === "edit") {
      if (message.role !== "user") return;

      chatInput.value = message.content;
      autoGrow();

      conversation.messages.splice(index, 1);

      updateConversationMeta(conversation);
      renderMessages();

      chatInput.focus();
      return;
    }

    if (action === "regenerate") {
      if (message.role !== "assistant" || isGenerating) return;

      conversation.messages = conversation.messages.slice(0, index);
      updateConversationMeta(conversation);
      renderMessages();

      await requestAssistantReply(conversation);
      return;
    }

    if (action === "like" || action === "dislike") {
      message.feedback = action;
      updateConversationMeta(conversation);

      button.classList.add("is-active");

      toast(
        action === "like"
          ? "Thanks for the feedback."
          : "Feedback recorded."
      );
    }
  });

  /* =========================
     ATTACHMENTS
  ========================== */

  attachBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", () => {
    const files = [...fileInput.files];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast("Only image attachments are supported.", true);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast(`${file.name} is larger than 10 MB.`, true);
        continue;
      }

      pendingAttachments.push(file);
    }

    fileInput.value = "";
    renderAttachments();
  });

  function renderAttachments() {
    if (!chatAttachments) return;

    chatAttachments.innerHTML = pendingAttachments.map((file, index) => `
      <span class="attachment-chip">
        <span>▧</span>
        <span>${escapeHTML(file.name)}</span>
        <button
          type="button"
          data-remove-attachment="${index}"
          aria-label="Remove attachment"
        >
          ×
        </button>
      </span>
    `).join("");
  }

  chatAttachments?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-attachment]");
    if (!button) return;

    pendingAttachments.splice(Number(button.dataset.removeAttachment), 1);
    renderAttachments();
  });

  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read attachment."));

      reader.readAsDataURL(file);
    });
  }

  /* =========================
     VOICE INPUT
  ========================== */

  let recognition = null;

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition && $("#voiceBtn")) {
    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let text = "";

      for (const result of event.results) {
        text += result[0].transcript;
      }

      chatInput.value = text;
      autoGrow();
    };

    recognition.onerror = () => {
      $("#voiceBtn").classList.remove("is-active");
      toast("Voice input was unavailable.", true);
    };

    recognition.onend = () => {
      $("#voiceBtn").classList.remove("is-active");
    };

    $("#voiceBtn").addEventListener("click", () => {
      try {
        recognition.start();
        $("#voiceBtn").classList.add("is-active");
      } catch {
        // Recognition is already active.
      }
    });
  } else {
    $("#voiceBtn")?.addEventListener("click", () => {
      toast("Voice input is not supported by this browser.", true);
    });
  }

  /* =========================
     INPUT
  ========================== */

  function autoGrow() {
    chatInput.style.height = "auto";
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 180)}px`;
  }

  chatInput?.addEventListener("input", autoGrow);

  chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  $$(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      chatInput.value = button.dataset.prompt || "";

      if (button.dataset.enableResearch === "true") {
        researchToggle.click();
      }

      autoGrow();
      chatInput.focus();
    });
  });

  /* =========================
     SEND
  ========================== */

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isGenerating) return;

    const text = chatInput.value.trim();

    if (!text && !pendingAttachments.length) return;

    const conversation = ensureConversation();

    let content = text;

    const attachments = [];

    for (const file of pendingAttachments) {
      try {
        const dataURL = await fileToDataURL(file);

        attachments.push({
          name: file.name,
          type: file.type,
          data: dataURL
        });
      } catch {
        toast(`Unable to attach ${file.name}.`, true);
      }
    }

    if (!content && attachments.length) {
      content = "Please analyze the attached image.";
    }

    conversation.messages.push({
      role: "user",
      content,
      attachments
    });

    updateConversationMeta(conversation);

    chatInput.value = "";
    chatInput.style.height = "auto";

    pendingAttachments = [];
    renderAttachments();

    renderConversationList();
    renderMessages();

    await requestAssistantReply(conversation);
  });

  /* =========================
     AI REQUEST
  ========================== */

  async function requestAssistantReply(conversation) {
    if (isGenerating) return;

    isGenerating = true;
    abortController = new AbortController();

    sendBtn.hidden = true;
    stopBtn.hidden = false;

    const assistant = {
      role: "assistant",
      content: "",
      researched: false,
      sources: []
    };

    conversation.messages.push(assistant);
    renderMessages();

    try {
      const messages = conversation.messages
        .slice(0, -1)
        .map((message) => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments || []
        }));

      const memoryEnabled =
        localStorage.getItem(STORAGE.memory) === "true";

      const payload = {
        messages,
        model: modelSelect?.value || "openai/gpt-oss-120b",
        research: researchToggle?.getAttribute("aria-pressed") === "true",
        responseLength:
          localStorage.getItem(STORAGE.responseLength) || "balanced",
        responseStyle:
          localStorage.getItem(STORAGE.responseStyle) || "professional",
        memory: memoryEnabled,
        customInstructions:
          localStorage.getItem(STORAGE.instructions) || ""
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json"
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      if (!response.ok) {
        let errorMessage = "The AI could not complete the response.";

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Keep fallback.
        }

        throw new Error(errorMessage);
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (
        contentType.includes("text/event-stream") &&
        response.body
      ) {
        await consumeStream(response.body, assistant);
      } else {
        const data = await response.json();

        assistant.content =
          typeof data.answer === "string"
            ? data.answer
            : typeof data.content === "string"
              ? data.content
              : "";

        assistant.researched = Boolean(data.researched);
        assistant.sources = Array.isArray(data.sources)
          ? data.sources
          : [];

        renderMessages();
      }

      if (!assistant.content.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      updateConversationMeta(conversation);
      renderConversationList();
    } catch (error) {
      if (error.name === "AbortError") {
        if (!assistant.content.trim()) {
          conversation.messages.pop();
        } else {
          assistant.content += "\n\n_Generation stopped._";
        }

        renderMessages();
        return;
      }

      conversation.messages.pop();

      renderMessages();

      toast(
        error?.message ||
          "Something went wrong. Please try again.",
        true
      );
    } finally {
      isGenerating = false;
      abortController = null;

      sendBtn.hidden = false;
      stopBtn.hidden = true;
    }
  }

  async function consumeStream(stream, assistant) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const lines = event.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const raw = line.slice(5).trim();

          if (!raw || raw === "[DONE]") continue;

          let payload;

          try {
            payload = JSON.parse(raw);
          } catch {
            continue;
          }

          if (payload.type === "text") {
            assistant.content += payload.text || "";
            renderMessages();
          }

          if (payload.type === "meta") {
            assistant.researched = Boolean(payload.researched);
            assistant.sources = Array.isArray(payload.sources)
              ? payload.sources
              : [];
          }

          if (payload.type === "error") {
            throw new Error(
              payload.message || "Streaming failed."
            );
          }
        }
      }
    }
  }

  stopBtn?.addEventListener("click", () => {
    abortController?.abort();
  });

  /* =========================
     RESEARCH
  ========================== */

  researchToggle?.addEventListener("click", () => {
    const enabled =
      researchToggle.getAttribute("aria-pressed") === "true";

    researchToggle.setAttribute(
      "aria-pressed",
      String(!enabled)
    );
  });

  /* =========================
     CHAT HISTORY PANEL
  ========================== */

  $("#chatHistoryBtn")?.addEventListener("click", () => {
    chatHistoryPanel.classList.toggle("is-open");
  });

  $("#closeHistoryPanel")?.addEventListener("click", () => {
    chatHistoryPanel.classList.remove("is-open");
  });

  /* =========================
     CHAT SETTINGS MODAL
  ========================== */

  $("#chatSettingsBtn")?.addEventListener("click", () => {
    const length =
      localStorage.getItem(STORAGE.responseLength) || "balanced";

    const style =
      localStorage.getItem(STORAGE.responseStyle) || "professional";

    openModal(
      "Chat preferences",
      `
        <div class="modal-field">
          <label for="responseLength">Response length</label>

          <select id="responseLength" class="select-field" style="width:100%">
            <option value="concise" ${length === "concise" ? "selected" : ""}>Concise</option>
            <option value="balanced" ${length === "balanced" ? "selected" : ""}>Balanced</option>
            <option value="detailed" ${length === "detailed" ? "selected" : ""}>Detailed</option>
          </select>
        </div>

        <div class="modal-field" style="margin-top:14px">
          <label for="responseStyle">Response style</label>

          <select id="responseStyle" class="select-field" style="width:100%">
            <option value="professional" ${style === "professional" ? "selected" : ""}>Professional</option>
            <option value="friendly" ${style === "friendly" ? "selected" : ""}>Friendly</option>
            <option value="technical" ${style === "technical" ? "selected" : ""}>Technical</option>
            <option value="simple" ${style === "simple" ? "selected" : ""}>Simple</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn" type="button" data-modal-cancel>Cancel</button>
          <button class="btn btn--primary" type="button" data-save-chat-settings>Save</button>
        </div>
      `
    );

    $("#modalBody")?.addEventListener(
      "click",
      saveChatSettingsOnce
    );
  });

  function saveChatSettingsOnce(event) {
    const save = event.target.closest("[data-save-chat-settings]");
    const cancel = event.target.closest("[data-modal-cancel]");

    if (cancel) {
      closeModal();
      return;
    }

    if (!save) return;

    localStorage.setItem(
      STORAGE.responseLength,
      $("#responseLength")?.value || "balanced"
    );

    localStorage.setItem(
      STORAGE.responseStyle,
      $("#responseStyle")?.value || "professional"
    );

    closeModal();
    toast("Chat preferences saved.");
  }

  /* =========================
     SETTINGS
  ========================== */

  $("#customInstructionsBtn")?.addEventListener("click", () => {
    const current =
      localStorage.getItem(STORAGE.instructions) || "";

    openModal(
      "Custom instructions",
      `
        <div class="modal-field">
          <label for="customInstructions">
            Instructions for OZLIND AI
          </label>

          <textarea
            id="customInstructions"
            maxlength="4000"
            placeholder="Example: Keep answers concise and explain technical terms simply."
          >${escapeHTML(current)}</textarea>
        </div>

        <div class="modal-actions">
          <button class="btn" type="button" data-modal-cancel>
            Cancel
          </button>

          <button class="btn btn--primary" type="button" data-save-instructions>
            Save
          </button>
        </div>
      `
    );
  });

  $("#modalBody")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-cancel]")) {
      closeModal();
    }

    if (event.target.closest("[data-save-instructions]")) {
      localStorage.setItem(
        STORAGE.instructions,
        $("#customInstructions")?.value.trim() || ""
      );

      closeModal();
      toast("Custom instructions saved.");
    }
  });

  const memoryToggle = $("#memoryToggle");

  if (memoryToggle) {
    memoryToggle.checked =
      localStorage.getItem(STORAGE.memory) === "true";

    memoryToggle.addEventListener("change", () => {
      localStorage.setItem(
        STORAGE.memory,
        String(memoryToggle.checked)
      );

      toast(
        memoryToggle.checked
          ? "Local memory enabled."
          : "Local memory disabled."
      );
    });
  }

  /* =========================
     EXPORT / IMPORT
  ========================== */

  $("#exportHistoryBtn")?.addEventListener("click", () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ozlind-history-${Date.now()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    toast("History exported.");
  });

  $("#importHistoryBtn")?.addEventListener("click", () => {
    $("#importHistoryInput")?.click();
  });

  $("#importHistoryInput")?.addEventListener("change", async () => {
    const file = $("#importHistoryInput").files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const imported =
        Array.isArray(data)
          ? data
          : data.conversations;

      if (!Array.isArray(imported)) {
        throw new Error("Invalid history file.");
      }

      const valid = imported.filter(
        (conversation) =>
          conversation &&
          typeof conversation.id === "string" &&
          Array.isArray(conversation.messages)
      );

      if (!valid.length) {
        throw new Error("No valid conversations found.");
      }

      conversations = valid;
      activeId = conversations[0]?.id || null;

      saveConversations();
      renderConversationList();
      renderMessages();
      renderHistoryPage();

      toast(`${valid.length} conversation(s) imported.`);
    } catch (error) {
      toast(
        error?.message || "Invalid history file.",
        true
      );
    } finally {
      $("#importHistoryInput").value = "";
    }
  });

  $("#clearDataBtn")?.addEventListener("click", () => {
    openModal(
      "Clear local data",
      `
        <p style="color:var(--muted);font-size:11px;line-height:1.6">
          This will permanently remove your local conversations,
          preferences, and settings from this browser.
        </p>

        <div class="modal-actions">
          <button class="btn" type="button" data-modal-cancel>
            Cancel
          </button>

          <button class="btn" type="button" data-clear-confirm
            style="color:#fff;background:var(--danger);border-color:var(--danger)">
            Clear everything
          </button>
        </div>
      `
    );
  });

  $("#modalBody")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-confirm]")) {
      localStorage.clear();
      window.location.reload();
    }
  });

  /* =========================
     MODAL
  ========================== */

  const modalOverlay = $("#modalOverlay");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");

  function openModal(title, bodyHTML) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalOverlay.hidden = true;
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  $("#modalClose")?.addEventListener("click", closeModal);

  modalOverlay?.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!modalOverlay.hidden) {
        closeModal();
      } else {
        closeMobileSidebar();
      }
    }
  });

  window.ozlindModal = {
    open: openModal,
    close: closeModal
  };

  /* =========================
     TOAST
  ========================== */

  function toast(message, error = false) {
    const stack = $("#toastStack");
    if (!stack) return;

    const element = document.createElement("div");

    element.className =
      `toast ${error ? "toast--error" : ""}`;

    element.textContent = message;

    stack.appendChild(element);

    setTimeout(() => {
      element.remove();
    }, 3500);
  }

  window.ozlindToast = toast;

  /* =========================
     INIT
  ========================== */

  renderConversationList();
  renderMessages();
  renderHistoryPage();
  autoGrow();

})();
