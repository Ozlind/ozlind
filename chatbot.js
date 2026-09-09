(() => {
  "use strict";

  /* =========================================================
     OZLIND AI — CHAT ENGINE
     =========================================================
     Features:
     - Chat + streaming
     - Auto / Fast / Smart / Research / Code / Write
     - Groq / Gemini / Experiential routing via /api/chat
     - Web research
     - Vision/image upload
     - Voice input
     - Conversation history
     - Search history
     - Rename / delete conversations
     - Import / export
     - Memory toggle
     - Custom instructions
     - Response length/style
     - Theme
     - Regenerate
     - Edit
     - Copy
     - Feedback
     - Stop generation
     - Mobile sidebar
     - Modal + toast system
     ========================================================= */

  const STORAGE = {
    conversations: "ozlind:conversations",
    settings: "ozlind:chat-settings",
    instructions: "ozlind:custom-instructions",
    memory: "ozlind:memory",
    theme: "ozlind:theme"
  };

  const LIMITS = {
    conversations: 100,
    messages: 100,
    messageChars: 12000,
    attachmentSize: 8 * 1024 * 1024,
    maxAttachments: 4,
    maxImageDimension: 1600,
    maxInstructions: 5000
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  /* =========================================================
     DOM
     ========================================================= */

  const chatMessages = $("#chatMessages");
  const chatEmpty = $("#chatEmpty");
  const chatForm = $("#chatForm");
  const chatInput = $("#chatInput");
  const sendBtn = $("#sendBtn");
  const stopBtn = $("#stopBtn");

  const modelSelect = $("#modelSelect");
  const researchToggle = $("#researchToggle");

  const attachBtn = $("#attachBtn");
  const fileInput = $("#fileInput");
  const chatAttachments = $("#chatAttachments");
  const voiceBtn = $("#voiceBtn");

  const newChatBtn = $("#newChatBtn");

  const chatHistoryPanel = $("#chatHistoryPanel");
  const closeHistoryPanel = $("#closeHistoryPanel");
  const conversationSearch = $("#conversationSearch");
  const conversationList = $("#conversationList");

  const mobileNavBtn = $("#mobileNavBtn");
  const sidebarOverlay = $("#sidebarOverlay");
  const sidebarCollapse = $("#sidebarCollapse");

  const modalOverlay = $("#modalOverlay");
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalClose = $("#modalClose");

  const toastStack = $("#toastStack");

  const memoryToggle = $("#memoryToggle");
  const customInstructions = $("#customInstructions");
  const responseLength = $("#responseLength");
  const responseStyle = $("#responseStyle");
  const themeSelect = $("#themeSelect");

  const saveInstructionsBtn = $("#saveInstructionsBtn");

  /* =========================================================
     STATE
     ========================================================= */

  let conversations = loadConversations();
  let activeConversationId =
    conversations[0]?.id || null;

  let pendingAttachments = [];

  let controller = null;
  let generating = false;

  let recognition = null;
  let listening = false;

  let currentView = "chat";

  /* =========================================================
     HELPERS
     ========================================================= */

  function id(prefix = "id") {
    if (
      window.crypto &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}_${crypto.randomUUID()}`;
    }

    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2)
    );
  }

  function now() {
    return new Date().toISOString();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getStorage(key, fallback = "") {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      toast("Browser storage is full.", "error");
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  /* =========================================================
     TOAST
     ========================================================= */

  function toast(message, type = "info") {
    if (!toastStack) return;

    const element =
      document.createElement("div");

    element.className =
      "toast" +
      (type === "error" ? " is-error" : "") +
      (type === "success" ? " is-success" : "");

    element.textContent = message;

    toastStack.appendChild(element);

    setTimeout(() => {
      element.remove();
    }, 3200);
  }

  /* =========================================================
     THEME
     ========================================================= */

  function applyTheme(theme) {
    const valid =
      theme === "light" ||
      theme === "dark"
        ? theme
        : "dark";

    document.body.dataset.theme = valid;

    if (themeSelect) {
      themeSelect.value = valid;
    }

    setStorage(STORAGE.theme, valid);
  }

  function loadTheme() {
    const saved =
      getStorage(STORAGE.theme, "dark");

    applyTheme(saved);
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function loadSettings() {
    const saved = parseJSON(
      getStorage(STORAGE.settings, "{}"),
      {}
    );

    if (responseLength) {
      responseLength.value =
        ["short", "balanced", "detailed"].includes(
          saved.responseLength
        )
          ? saved.responseLength
          : "balanced";
    }

    if (responseStyle) {
      responseStyle.value =
        [
          "professional",
          "friendly",
          "concise",
          "technical"
        ].includes(saved.responseStyle)
          ? saved.responseStyle
          : "professional";
    }

    if (customInstructions) {
      customInstructions.value =
        getStorage(
          STORAGE.instructions,
          ""
        ).slice(
          0,
          LIMITS.maxInstructions
        );
    }

    if (memoryToggle) {
      memoryToggle.setAttribute(
        "aria-checked",
        getStorage(STORAGE.memory, "true") !==
          "false"
      );
    }
  }

  function saveSettings() {
    setStorage(
      STORAGE.settings,
      JSON.stringify({
        responseLength:
          responseLength?.value ||
          "balanced",

        responseStyle:
          responseStyle?.value ||
          "professional"
      })
    );
  }

  /* =========================================================
     CONVERSATIONS
     ========================================================= */

  function normalizeMessage(message) {
    if (!message || typeof message !== "object") {
      return null;
    }

    if (
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      return null;
    }

    return {
      id:
        typeof message.id === "string"
          ? message.id
          : id("msg"),

      role: message.role,

      content:
        typeof message.content === "string"
          ? message.content.slice(
              0,
              LIMITS.messageChars
            )
          : "",

      createdAt:
        typeof message.createdAt === "string"
          ? message.createdAt
          : now(),

      attachments:
        Array.isArray(message.attachments)
          ? message.attachments
              .filter(
                a =>
                  a &&
                  typeof a.dataUrl === "string"
              )
              .slice(
                0,
                LIMITS.maxAttachments
              )
          : [],

      feedback:
        message.feedback === "like" ||
        message.feedback === "dislike"
          ? message.feedback
          : null
    };
  }

  function normalizeConversation(item) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string"
    ) {
      return null;
    }

    return {
      id: item.id,

      title:
        typeof item.title === "string" &&
        item.title.trim()
          ? item.title
              .trim()
              .slice(0, 100)
          : "New chat",

      createdAt:
        item.createdAt || now(),

      updatedAt:
        item.updatedAt ||
        item.createdAt ||
        now(),

      messages:
        Array.isArray(item.messages)
          ? item.messages
              .map(normalizeMessage)
              .filter(Boolean)
              .slice(
                0,
                LIMITS.messages
              )
          : []
    };
  }

  function loadConversations() {
    const data = parseJSON(
      getStorage(
        STORAGE.conversations,
        "[]"
      ),
      []
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(normalizeConversation)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      )
      .slice(
        0,
        LIMITS.conversations
      );
  }

  function saveConversations() {
    setStorage(
      STORAGE.conversations,
      JSON.stringify(conversations)
    );
  }

  function activeConversation() {
    return conversations.find(
      c => c.id === activeConversationId
    );
  }

  function createConversation() {
    const conversation = {
      id: id("chat"),
      title: "New chat",
      createdAt: now(),
      updatedAt: now(),
      messages: []
    };

    conversations.unshift(conversation);

    conversations =
      conversations.slice(
        0,
        LIMITS.conversations
      );

    activeConversationId =
      conversation.id;

    saveConversations();

    renderConversationList();
    renderMessages();

    return conversation;
  }

  function ensureConversation() {
    return (
      activeConversation() ||
      createConversation()
    );
  }

  function newChat() {
    pendingAttachments = [];
    renderAttachments();

    createConversation();

    closeHistoryPanelUI();

    focusInput();
  }

  function conversationTitle(text) {
    const clean =
      String(text || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) {
      return "New chat";
    }

    let title =
      clean
        .split(" ")
        .slice(0, 8)
        .join(" ");

    if (title.length > 60) {
      title =
        title.slice(0, 60).trim();
    }

    if (clean.length > title.length) {
      title += "…";
    }

    return title;
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function showView(view) {
    const views = {
      chat: "#chatView",
      history: "#historyView",
      research: "#researchView",
      vision: "#visionView",
      settings: "#settingsView"
    };

    if (!views[view]) {
      view = "chat";
    }

    currentView = view;

    $$(".view").forEach(element => {
      element.classList.remove(
        "is-active"
      );
    });

    const target = $(views[view]);

    if (target) {
      target.classList.add("is-active");
    }

    $$("[data-view]").forEach(item => {
      item.classList.toggle(
        "is-active",
        item.dataset.view === view
      );
    });

    document.body.classList.remove(
      "sidebar-open"
    );

    if (view === "history") {
      renderConversationList();
    }

    if (view === "settings") {
      loadSettings();
    }
  }

  /* =========================================================
     SIDEBAR
     ========================================================= */

  function toggleMobileSidebar() {
    document.body.classList.toggle(
      "sidebar-open"
    );
  }

  function closeMobileSidebar() {
    document.body.classList.remove(
      "sidebar-open"
    );
  }

  function toggleSidebarCollapse() {
    document.body.classList.toggle(
      "sidebar-collapsed"
    );

    setStorage(
      "ozlind:sidebar-collapsed",
      document.body.classList.contains(
        "sidebar-collapsed"
      )
        ? "true"
        : "false"
    );
  }

  function loadSidebarState() {
    if (
      getStorage(
        "ozlind:sidebar-collapsed",
        "false"
      ) === "true"
    ) {
      document.body.classList.add(
        "sidebar-collapsed"
      );
    }
  }

  /* =========================================================
     HISTORY UI
     ========================================================= */

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const today =
      new Date().toDateString();

    if (
      date.toDateString() === today
    ) {
      return date.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
    }

    return date.toLocaleDateString(
      [],
      {
        month: "short",
        day: "numeric"
      }
    );
  }

  function renderConversationList(
    filter = ""
  ) {
    if (!conversationList) return;

    const query =
      String(filter || "")
        .trim()
        .toLowerCase();

    const list =
      conversations.filter(c => {
        if (!query) return true;

        return (
          c.title
            .toLowerCase()
            .includes(query) ||
          c.messages.some(m =>
            m.content
              .toLowerCase()
              .includes(query)
          )
        );
      });

    conversationList.innerHTML = "";

    if (!list.length) {
      const empty =
        document.createElement("div");

      empty.style.padding = "30px 15px";
      empty.style.textAlign = "center";
      empty.style.color =
        "var(--text-muted)";
      empty.textContent =
        query
          ? "No conversations found."
          : "No conversations yet.";

      conversationList.appendChild(empty);
      return;
    }

    list.forEach(conversation => {
      const item =
        document.createElement("div");

      item.className =
        "conversation-item" +
        (conversation.id ===
        activeConversationId
          ? " is-active"
          : "");

      const main =
        document.createElement("button");

      main.className =
        "conversation-main";

      main.type = "button";

      main.innerHTML = `
        <span class="conversation-title">
          ${escapeHTML(conversation.title)}
        </span>
        <span class="conversation-date">
          ${escapeHTML(
            formatDate(
              conversation.updatedAt
            )
          )}
        </span>
      `;

      main.addEventListener(
        "click",
        () => {
          activeConversationId =
            conversation.id;

          saveConversations();
          renderConversationList();

          showView("chat");
          renderMessages();

          closeHistoryPanelUI();
        }
      );

      const deleteBtn =
        document.createElement("button");

      deleteBtn.className =
        "conversation-delete";

      deleteBtn.type = "button";
      deleteBtn.title =
        "Delete conversation";
      deleteBtn.setAttribute(
        "aria-label",
        "Delete conversation"
      );

      deleteBtn.textContent = "×";

      deleteBtn.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          deleteConversation(
            conversation.id
          );
        }
      );

      item.appendChild(main);
      item.appendChild(deleteBtn);

      conversationList.appendChild(item);
    });
  }

  function deleteConversation(idValue) {
    const conversation =
      conversations.find(
        c => c.id === idValue
      );

    if (!conversation) return;

    if (
      !window.confirm(
        `Delete "${conversation.title}"?`
      )
    ) {
      return;
    }

    conversations =
      conversations.filter(
        c => c.id !== idValue
      );

    if (
      activeConversationId === idValue
    ) {
      activeConversationId =
        conversations[0]?.id || null;
    }

    saveConversations();
    renderConversationList();
    renderMessages();

    toast(
      "Conversation deleted.",
      "success"
    );
  }

  /* =========================================================
     HISTORY PANEL
     ========================================================= */

  function openHistoryPanelUI() {
    if (!chatHistoryPanel) return;

    chatHistoryPanel.classList.add(
      "is-open"
    );
  }

  function closeHistoryPanelUI() {
    if (!chatHistoryPanel) return;

    chatHistoryPanel.classList.remove(
      "is-open"
    );
  }

  /* =========================================================
     MESSAGE RENDERING
     ========================================================= */

  function markdown(text) {
    let html =
      escapeHTML(text || "");

    const codeBlocks = [];

    html = html.replace(
      /```([\s\S]*?)```/g,
      (_, code) => {
        const index =
          codeBlocks.push(code) - 1;

        return `@@CODE${index}@@`;
      }
    );

    html = html.replace(
      /^### (.*)$/gm,
      "<h3>$1</h3>"
    );

    html = html.replace(
      /^## (.*)$/gm,
      "<h2>$1</h2>"
    );

    html = html.replace(
      /^# (.*)$/gm,
      "<h1>$1</h1>"
    );

    html = html.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    html = html.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

    html = html.replace(
      /^\s*[-*] (.*)$/gm,
      "<li>$1</li>"
    );

    html = html.replace(
      /(<li>.*<\/li>)/gs,
      "<ul>$1</ul>"
    );

    html = html.replace(
      /\n{2,}/g,
      "</p><p>"
    );

    html =
      "<p>" + html + "</p>";

    html = html.replace(
      /@@CODE(\d+)@@/g,
      (_, index) => {
        const code =
          escapeHTML(
            codeBlocks[
              Number(index)
            ] || ""
          );

        return `
          <pre><code>${code}</code></pre>
        `;
      }
    );

    return html;
  }

  function messageAvatar(role) {
    return role === "user"
      ? "You"
      : "O";
  }

  function renderMessages() {
    if (!chatMessages) return;

    const conversation =
      activeConversation();

    chatMessages.innerHTML = "";

    if (
      !conversation ||
      !conversation.messages.length
    ) {
      if (chatEmpty) {
        chatEmpty.hidden = false;
        chatMessages.appendChild(
          chatEmpty
        );
      }

      return;
    }

    if (chatEmpty) {
      chatEmpty.hidden = true;
    }

    conversation.messages.forEach(
      message => {
        const element =
          document.createElement("article");

        element.className =
          `message message--${message.role}`;

        element.dataset.id =
          message.id;

        element.innerHTML = `
          <div class="message-avatar">
            ${messageAvatar(message.role)}
          </div>

          <div class="message-content">
            <div class="message-role">
              ${
                message.role === "user"
                  ? "You"
                  : "Ozlind AI"
              }
            </div>

            <div class="message-text">
              ${
                message.content
                  ? markdown(
                      message.content
                    )
                  : ""
              }
            </div>

            <div class="message-actions">
              ${
                message.role ===
                "assistant"
                  ? `
                    <button
                      class="message-action"
                      data-action="copy"
                      title="Copy"
                    >⧉</button>

                    <button
                      class="message-action"
                      data-action="regenerate"
                      title="Regenerate"
                    >↻</button>

                    <button
                      class="message-action"
                      data-action="like"
                      title="Helpful"
                    >↑</button>

                    <button
                      class="message-action"
                      data-action="dislike"
                      title="Not helpful"
                    >↓</button>
                  `
                  : `
                    <button
                      class="message-action"
                      data-action="edit"
                      title="Edit"
                    >✎</button>

                    <button
                      class="message-action"
                      data-action="copy"
                      title="Copy"
                    >⧉</button>
                  `
              }
            </div>
          </div>
        `;

        chatMessages.appendChild(
          element
        );
      }
    );

    chatMessages.scrollTop =
      chatMessages.scrollHeight;
  }

  /* =========================================================
     MESSAGE ACTIONS
     ========================================================= */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      toast(
        "Copied to clipboard.",
        "success"
      );
    } catch {
      toast(
        "Copy failed.",
        "error"
      );
    }
  }

  function handleMessageAction(
    action,
    messageId
  ) {
    const conversation =
      activeConversation();

    if (!conversation) return;

    const index =
      conversation.messages.findIndex(
        m => m.id === messageId
      );

    if (index === -1) return;

    const message =
      conversation.messages[index];

    if (action === "copy") {
      copyText(message.content);
      return;
    }

    if (
      action === "like" ||
      action === "dislike"
    ) {
      message.feedback = action;

      saveConversations();
      renderMessages();

      toast(
        action === "like"
          ? "Thanks for the feedback."
          : "Feedback recorded."
      );

      return;
    }

    if (action === "edit") {
      if (message.role !== "user") {
        return;
      }

      chatInput.value =
        message.content;

      conversation.messages.splice(
        index
      );

      saveConversations();
      renderMessages();

      showView("chat");
      focusInput();

      return;
    }

    if (action === "regenerate") {
      regenerateFrom(messageId);
    }
  }

  async function regenerateFrom(
    assistantMessageId
  ) {
    const conversation =
      activeConversation();

    if (!conversation || generating) {
      return;
    }

    const assistantIndex =
      conversation.messages.findIndex(
        m =>
          m.id ===
          assistantMessageId
      );

    if (assistantIndex === -1) {
      return;
    }

    const previousUser =
      conversation.messages[
        assistantIndex - 1
      ];

    if (
      !previousUser ||
      previousUser.role !== "user"
    ) {
      return;
    }

    conversation.messages.splice(
      assistantIndex
    );

    saveConversations();
    renderMessages();

    await sendMessage(
      previousUser.content,
      previousUser.attachments || [],
      true
    );
  }

  /* =========================================================
     ATTACHMENTS
     ========================================================= */

  function renderAttachments() {
    if (!chatAttachments) return;

    chatAttachments.innerHTML = "";

    pendingAttachments.forEach(
      (attachment, index) => {
        const item =
          document.createElement("div");

        item.className =
          "attachment-item";

        item.innerHTML = `
          <span title="${escapeHTML(
            attachment.name
          )}">
            ${escapeHTML(
              attachment.name
            )}
          </span>

          <button
            class="attachment-remove"
            type="button"
            data-index="${index}"
            aria-label="Remove attachment"
          >×</button>
        `;

        chatAttachments.appendChild(
          item
        );
      }
    );
  }

  function resizeImage(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onerror = () =>
          reject(
            new Error(
              "Could not read image."
            )
          );

        reader.onload = () => {
          const image =
            new Image();

          image.onerror = () =>
            reject(
              new Error(
                "Invalid image."
              )
            );

          image.onload = () => {
            let width =
              image.naturalWidth;

            let height =
              image.naturalHeight;

            const max =
              LIMITS.maxImageDimension;

            if (
              width <= max &&
              height <= max
            ) {
              resolve({
                dataUrl:
                  reader.result,
                width,
                height
              });

              return;
            }

            const scale =
              Math.min(
                max / width,
                max / height
              );

            width =
              Math.round(
                width * scale
              );

            height =
              Math.round(
                height * scale
              );

            const canvas =
              document.createElement(
                "canvas"
              );

            canvas.width = width;
            canvas.height = height;

            const ctx =
              canvas.getContext(
                "2d"
              );

            ctx.drawImage(
              image,
              0,
              0,
              width,
              height
            );

            resolve({
              dataUrl:
                canvas.toDataURL(
                  "image/jpeg",
                  0.86
                ),
              width,
              height
            });
          };

          image.src =
            reader.result;
        };

        reader.readAsDataURL(file);
      }
    );
  }

  async function handleFiles(files) {
    const incoming =
      Array.from(files || []);

    if (!incoming.length) return;

    if (
      pendingAttachments.length >=
      LIMITS.maxAttachments
    ) {
      toast(
        "Maximum 4 images allowed.",
        "error"
      );

      return;
    }

    for (
      const file of incoming
    ) {
      if (
        pendingAttachments.length >=
        LIMITS.maxAttachments
      ) {
        break;
      }

      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        toast(
          `${file.name} is not an image.`,
          "error"
        );

        continue;
      }

      if (
        file.size >
        LIMITS.attachmentSize
      ) {
        toast(
          `${file.name} is larger than 8 MB.`,
          "error"
        );

        continue;
      }

      try {
        const image =
          await resizeImage(file);

        pendingAttachments.push({
          name: file.name,
          type:
            file.type ||
            "image/jpeg",
          dataUrl:
            image.dataUrl,
          width:
            image.width,
          height:
            image.height
        });
      } catch {
        toast(
          `Could not process ${file.name}.`,
          "error"
        );
      }
    }

    renderAttachments();
  }

  /* =========================================================
     VOICE INPUT
     ========================================================= */

  function setupVoice() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (voiceBtn) {
        voiceBtn.disabled = true;
        voiceBtn.title =
          "Voice input is not supported by this browser";
      }

      return;
    }

    recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      listening = true;

      voiceBtn?.classList.add(
        "is-active"
      );

      toast("Listening…");
    };

    recognition.onresult = event => {
      let text = "";

      for (
        let i =
          event.resultIndex;
        i < event.results.length;
        i++
      ) {
        text +=
          event.results[i][0].transcript;
      }

      if (chatInput) {
        chatInput.value =
          text.trim();

        autoResizeInput();
      }
    };

    recognition.onerror = () => {
      listening = false;

      voiceBtn?.classList.remove(
        "is-active"
      );

      toast(
        "Voice input failed.",
        "error"
      );
    };

    recognition.onend = () => {
      listening = false;

      voiceBtn?.classList.remove(
        "is-active"
      );
    };
  }

  function toggleVoice() {
    if (!recognition) {
      toast(
        "Voice input is not supported here.",
        "error"
      );

      return;
    }

    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }

  /* =========================================================
     API REQUEST
     ========================================================= */

  function buildApiMessages(
    conversation
  ) {
    return conversation.messages
      .slice(-20)
      .map(message => {
        if (
          message.attachments?.length
        ) {
          return {
            role: message.role,
            content: [
              {
                type: "text",
                text: message.content
              },

              ...message.attachments.map(
                attachment => ({
                  type: "image_url",
                  image_url: {
                    url:
                      attachment.dataUrl
                  }
                })
              )
            ]
          };
        }

        return {
          role: message.role,
          content:
            message.content
        };
      });
  }

  function buildRequest(
    conversation,
    mode,
    research
  ) {
    return {
      messages:
        buildApiMessages(
          conversation
        ),

      model:
        mode || "auto",

      mode:
        mode || "auto",

      research: Boolean(research),

      memory:
        getStorage(
          STORAGE.memory,
          "true"
        ) !== "false",

      customInstructions:
        getStorage(
          STORAGE.instructions,
          ""
        ).slice(
          0,
          LIMITS.maxInstructions
        ),

      responseLength:
        responseLength?.value ||
        "balanced",

      responseStyle:
        responseStyle?.value ||
        "professional"
    };
  }

  /* =========================================================
     STREAM PARSER
     ========================================================= */

  async function readResponse(
    response,
    onToken
  ) {
    if (!response.body) {
      const data =
        await response.json();

      return (
        data?.message ||
        data?.content ||
        data?.choices?.[0]?.message
          ?.content ||
        ""
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";
    let fullText = "";

    while (true) {
      const {
        value,
        done
      } = await reader.read();

      if (done) break;

      buffer += decoder.decode(
        value,
        { stream: true }
      );

      const lines =
        buffer.split("\n");

      buffer =
        lines.pop() || "";

      for (
        const line of lines
      ) {
        const clean =
          line.trim();

        if (!clean) continue;

        if (
          !clean.startsWith(
            "data:"
          )
        ) {
          continue;
        }

        const payload =
          clean.slice(5).trim();

        if (
          payload ===
          "[DONE]"
        ) {
          continue;
        }

        try {
          const data =
            JSON.parse(payload);

          const token =
            data?.choices?.[0]
              ?.delta?.content ??
            data?.choices?.[0]
              ?.message?.content ??
            data?.token ??
            data?.content ??
            "";

          if (token) {
            fullText += token;
            onToken(token);
          }
        } catch {
          /*
           * Some backends may send
           * non-JSON SSE lines.
           */
        }
      }
    }

    return fullText;
  }

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  async function sendMessage(
    text,
    attachments = [],
    regenerate = false
  ) {
    if (generating) return;

    const clean =
      String(text || "").trim();

    if (
      !clean &&
      !attachments.length
    ) {
      return;
    }

    if (
      clean.length >
      LIMITS.messageChars
    ) {
      toast(
        "Message is too long.",
        "error"
      );

      return;
    }

    const conversation =
      ensureConversation();

    if (!regenerate) {
      conversation.messages.push({
        id: id("msg"),
        role: "user",
        content: clean,
        createdAt: now(),
        attachments
      });

      if (
        conversation.messages.length ===
        1
      ) {
        conversation.title =
          conversationTitle(clean);
      }
    }

    updateConversation(
      conversation
    );

    saveConversations();
    renderMessages();

    pendingAttachments = [];
    renderAttachments();

    if (chatInput) {
      chatInput.value = "";
      autoResizeInput();
    }

    generating = true;
    controller =
      new AbortController();

    setGeneratingUI(true);

    const assistant = {
      id: id("msg"),
      role: "assistant",
      content: "",
      createdAt: now(),
      attachments: [],
      feedback: null
    };

    conversation.messages.push(
      assistant
    );

    renderMessages();

    const assistantElement =
      () =>
        $(
          `.message[data-id="${assistant.id}"] .message-text`
        );

    try {
      const mode =
        modelSelect?.value ||
        "auto";

      const research =
        Boolean(
          researchToggle?.getAttribute(
            "aria-pressed"
          ) === "true" ||
            mode === "research"
        );

      const payload =
        buildRequest(
          conversation,
          mode,
          research
        );

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "text/event-stream"
            },

            body:
              JSON.stringify(
                payload
              ),

            signal:
              controller.signal
          }
        );

      if (!response.ok) {
        let message =
          `Request failed (${response.status}).`;

        try {
          const error =
            await response.json();

          message =
            error?.error ||
            error?.message ||
            message;
        } catch {}

        throw new Error(message);
      }

      let liveText = "";

      await readResponse(
        response,
        token => {
          liveText += token;

          assistant.content =
            liveText;

          const target =
            assistantElement();

          if (target) {
            target.innerHTML =
              markdown(
                liveText
              );

            chatMessages.scrollTop =
              chatMessages.scrollHeight;
          }
        }
      );

      if (!assistant.content.trim()) {
        assistant.content =
          "I couldn't generate a response.";
      }

      updateConversation(
        conversation
      );

      saveConversations();
      renderMessages();

    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        conversation.messages =
          conversation.messages.filter(
            m =>
              m.id !==
              assistant.id
          );

        saveConversations();
        renderMessages();

        toast(
          "Generation stopped."
        );

        return;
      }

      console.error(
        "OZLIND AI:",
        error
      );

      conversation.messages =
        conversation.messages.filter(
          m =>
            m.id !== assistant.id
        );

      saveConversations();
      renderMessages();

      toast(
        error?.message ||
          "Something went wrong.",
        "error"
      );

    } finally {
      generating = false;
      controller = null;

      setGeneratingUI(false);
    }
  }

  function updateConversation(
    conversation
  ) {
    conversation.updatedAt =
      now();

    conversations.sort(
      (a, b) =>
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
    );
  }

  /* =========================================================
     GENERATION UI
     ========================================================= */

  function setGeneratingUI(active) {
    if (sendBtn) {
      sendBtn.hidden = active;
    }

    if (stopBtn) {
      stopBtn.hidden = !active;
    }

    if (chatInput) {
      chatInput.disabled =
        active;
    }

    if (attachBtn) {
      attachBtn.disabled =
        active;
    }

    if (voiceBtn) {
      voiceBtn.disabled =
        active;
    }

    const state =
      $("#composerState");

    if (state) {
      state.textContent =
        active
          ? "Ozlind is thinking…"
          : "";
    }
  }

  function stopGeneration() {
    if (controller) {
      controller.abort();
    }
  }

  /* =========================================================
     INPUT
     ========================================================= */

  function autoResizeInput() {
    if (!chatInput) return;

    chatInput.style.height =
      "auto";

    chatInput.style.height =
      Math.min(
        chatInput.scrollHeight,
        190
      ) + "px";
  }

  function focusInput() {
    setTimeout(() => {
      chatInput?.focus();
    }, 50);
  }

  function submitChat() {
    if (generating) return;

    const text =
      chatInput?.value || "";

    sendMessage(
      text,
      [...pendingAttachments]
    );
  }

  /* =========================================================
     RESEARCH TOGGLE
     ========================================================= */

  function toggleResearch() {
    if (!researchToggle) return;

    const active =
      researchToggle.getAttribute(
        "aria-pressed"
      ) === "true";

    researchToggle.setAttribute(
      "aria-pressed",
      String(!active)
    );

    researchToggle.classList.toggle(
      "is-active",
      !active
    );

    if (modelSelect) {
      if (!active) {
        modelSelect.value =
          "research";
      } else if (
        modelSelect.value ===
        "research"
      ) {
        modelSelect.value =
          "auto";
      }
    }
  }

  /* =========================================================
     MODAL
     ========================================================= */

  function openModal(
    title,
    content
  ) {
    if (
      !modalOverlay ||
      !modalTitle ||
      !modalBody
    ) {
      return;
    }

    modalTitle.textContent =
      title;

    modalBody.innerHTML =
      content;

    modalOverlay.classList.add(
      "is-open"
    );

    modal?.focus();
  }

  function closeModal() {
    modalOverlay?.classList.remove(
      "is-open"
    );
  }

  /* =========================================================
     IMPORT / EXPORT
     ========================================================= */

  function exportHistory() {
    const payload = {
      app: "Ozlind",
      version: 1,
      exportedAt: now(),
      conversations
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            payload,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;
    anchor.download =
      `ozlind-history-${Date.now()}.json`;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    toast(
      "Chat history exported.",
      "success"
    );
  }

  async function importHistory(
    file
  ) {
    if (!file) return;

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      toast(
        "History file is too large.",
        "error"
      );

      return;
    }

    try {
      const text =
        await file.text();

      const data =
        JSON.parse(text);

      const imported =
        Array.isArray(
          data
            ? data.conversations
            : data
        )
          ? (
              data.conversations ||
              data
            )
          : [];

      const normalized =
        imported
          .map(
            normalizeConversation
          )
          .filter(Boolean);

      if (!normalized.length) {
        throw new Error(
          "No valid conversations found."
        );
      }

      const existing =
        new Map(
          conversations.map(
            c => [c.id, c]
          )
        );

      normalized.forEach(c => {
        existing.set(c.id, c);
      });

      conversations =
        Array.from(
          existing.values()
        )
          .sort(
            (a, b) =>
              new Date(
                b.updatedAt
              ) -
              new Date(
                a.updatedAt
              )
          )
          .slice(
            0,
            LIMITS.conversations
          );

      activeConversationId =
        conversations[0]?.id ||
        null;

      saveConversations();
      renderConversationList();
      renderMessages();

      toast(
        "Chat history imported.",
        "success"
      );

    } catch (error) {
      toast(
        error?.message ||
          "Invalid history file.",
        "error"
      );
    }
  }

  /* =========================================================
     CLEAR HISTORY
     ========================================================= */

  function clearHistory() {
    if (!conversations.length) {
      toast("History is already empty.");
      return;
    }

    if (
      !window.confirm(
        "Delete all conversations?"
      )
    ) {
      return;
    }

    conversations = [];
    activeConversationId = null;

    saveConversations();

    renderConversationList();
    renderMessages();

    toast(
      "All conversations deleted.",
      "success"
    );
  }

  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function bindEvents() {
    /* Navigation */

    $$("[data-view]").forEach(
      element => {
        element.addEventListener(
          "click",
          () => {
            const view =
              element.dataset.view;

            if (view) {
              showView(view);
            }
          }
        );
      }
    );

    /* New chat */

    newChatBtn?.addEventListener(
      "click",
      newChat
    );

    /* Mobile sidebar */

    mobileNavBtn?.addEventListener(
      "click",
      toggleMobileSidebar
    );

    sidebarOverlay?.addEventListener(
      "click",
      closeMobileSidebar
    );

    sidebarCollapse?.addEventListener(
      "click",
      toggleSidebarCollapse
    );

    /* Chat */

    chatForm?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        submitChat();
      }
    );

    chatInput?.addEventListener(
      "input",
      autoResizeInput
    );

    chatInput?.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault();
          submitChat();
        }
      }
    );

    sendBtn?.addEventListener(
      "click",
      submitChat
    );

    stopBtn?.addEventListener(
      "click",
      stopGeneration
    );

    researchToggle?.addEventListener(
      "click",
      toggleResearch
    );

    /* Attachments */

    attachBtn?.addEventListener(
      "click",
      () => fileInput?.click()
    );

    fileInput?.addEventListener(
      "change",
      event => {
        handleFiles(
          event.target.files
        );

        event.target.value = "";
      }
    );

    chatAttachments?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            ".attachment-remove"
          );

        if (!button) return;

        const index =
          Number(
            button.dataset.index
          );

        pendingAttachments.splice(
          index,
          1
        );

        renderAttachments();
      }
    );

    /* Voice */

    voiceBtn?.addEventListener(
      "click",
      toggleVoice
    );

    /* History */

    conversationSearch?.addEventListener(
      "input",
      event => {
        renderConversationList(
          event.target.value
        );
      }
    );

    closeHistoryPanel?.addEventListener(
      "click",
      closeHistoryPanelUI
    );

    /* History panel buttons */

    $("#chatHistoryBtn")?.addEventListener(
      "click",
      openHistoryPanelUI
    );

    $("#chatHistoryBtn2")?.addEventListener(
      "click",
      openHistoryPanelPanelSafe
    );

    function openHistoryPanelPanelSafe() {
      openHistoryPanelUI();
    }

    /* Settings */

    $("#chatSettingsBtn")?.addEventListener(
      "click",
      () => showView("settings")
    );

    saveInstructionsBtn?.addEventListener(
      "click",
      () => {
        const value =
          customInstructions?.value
            ?.slice(
              0,
              LIMITS.maxInstructions
            ) || "";

        setStorage(
          STORAGE.instructions,
          value
        );

        saveSettings();

        toast(
          "Settings saved.",
          "success"
        );
      }
    );

    responseLength?.addEventListener(
      "change",
      saveSettings
    );

    responseStyle?.addEventListener(
      "change",
      saveSettings
    );

    memoryToggle?.addEventListener(
      "click",
      () => {
        const active =
          memoryToggle.getAttribute(
            "aria-checked"
          ) === "true";

        memoryToggle.setAttribute(
          "aria-checked",
          String(!active)
        );

        setStorage(
          STORAGE.memory,
          String(!active)
        );
      }
    );

    themeSelect?.addEventListener(
      "change",
      event => {
        applyTheme(
          event.target.value
        );
      }
    );

    /* Import / export */

    $("#exportHistoryBtn")?.addEventListener(
      "click",
      exportHistory
    );

    $("#importHistoryBtn")?.addEventListener(
      "click",
      () =>
        $("#historyFileInput")?.click()
    );

    $("#historyFileInput")?.addEventListener(
      "change",
      event => {
        importHistory(
          event.target.files?.[0]
        );

        event.target.value = "";
      }
    );

    $("#clearHistoryBtn")?.addEventListener(
      "click",
      clearHistory
    );

    /* Research */

    $("#startResearchBtn")?.addEventListener(
      "click",
      () => {
        showView("chat");

        if (modelSelect) {
          modelSelect.value =
            "research";
        }

        if (researchToggle) {
          researchToggle.setAttribute(
            "aria-pressed",
            "true"
          );

          researchToggle.classList.add(
            "is-active"
          );
        }

        focusInput();
      }
    );

    /* Vision */

    $("#startVisionBtn")?.addEventListener(
      "click",
      () => {
        showView("chat");

        fileInput?.click();

        if (modelSelect) {
          modelSelect.value =
            "smart";
        }

        focusInput();
      }
    );

    /* Modal */

    modalClose?.addEventListener(
      "click",
      closeModal
    );

    modalOverlay?.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modalOverlay
        ) {
          closeModal();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape"
        ) {
          closeModal();
          closeHistoryPanelUI();
          closeMobileSidebar();
        }
      }
    );

    /* Message actions */

    chatMessages?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) return;

        const message =
          button.closest(
            ".message"
          );

        if (!message) return;

        handleMessageAction(
          button.dataset.action,
          message.dataset.id
        );
      }
    );

    /* Suggestion cards */

    $$(".suggestion-card").forEach(
      card => {
        card.addEventListener(
          "click",
          () => {
            const prompt =
              card.dataset.prompt;

            if (!prompt) return;

            showView("chat");

            if (chatInput) {
              chatInput.value =
                prompt;

              autoResizeInput();
              focusInput();
            }
          }
        );
      }
    );

    /* Drag & drop */

    document.addEventListener(
      "dragover",
      event => {
        if (
          event.dataTransfer?.files
            ?.length
        ) {
          event.preventDefault();
        }
      }
    );

    document.addEventListener(
      "drop",
      event => {
        if (
          event.dataTransfer?.files
            ?.length
        ) {
          event.preventDefault();

          handleFiles(
            event.dataTransfer.files
          );
        }
      }
    );

    /* Paste images */

    chatInput?.addEventListener(
      "paste",
      event => {
        const items =
          Array.from(
            event.clipboardData
              ?.items || []
          );

        const images =
          items
            .filter(
              item =>
                item.type.startsWith(
                  "image/"
                )
            )
            .map(
              item =>
                item.getAsFile()
            )
            .filter(Boolean);

        if (images.length) {
          handleFiles(images);
        }
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    loadTheme();
    loadSettings();
    loadSidebarState();

    setupVoice();
    bindEvents();

    if (!conversations.length) {
      createConversation();
    } else {
      renderConversationList();
      renderMessages();
    }

    showView("chat");

    autoResizeInput();

    /*
     * Default connection state.
     * The backend will prove actual availability
     * when the first request is made.
     */

    const connectionDot =
      $("#connectionDot");

    const connectionText =
      $("#connectionText");

    const connectionSubtext =
      $("#connectionSubtext");

    if (connectionDot) {
      connectionDot.classList.add(
        "is-online"
      );
    }

    if (connectionText) {
      connectionText.textContent =
        "Ready";
    }

    if (connectionSubtext) {
      connectionSubtext.textContent =
        "AI workspace";
    }

    focusInput();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
