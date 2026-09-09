(() => {
  "use strict";

  /*
   * ============================================================
   * OZLIND AI — SYNCHRONIZED CHAT ENGINE
   * ============================================================
   *
   * Synchronized with:
   *   index.html
   *   /api/chat
   *
   * Features:
   *   Chat
   *   Auto / Fast / Smart / Research / Code / Write
   *   Groq / Gemini / Experiential routing
   *   Tavily research
   *   Vision image upload
   *   Voice input
   *   Conversation history
   *   Search history
   *   Rename / delete
   *   Import / export
   *   Memory toggle
   *   Custom instructions
   *   Response length/style
   *   Theme
   *   Regenerate
   *   Edit
   *   Copy
   *   Feedback
   *   Stop generation
   *   Mobile sidebar
   *   Sidebar collapse
   *   Modal
   *   Toast
   *
   * IMPORTANT:
   * image-editor.js is intentionally NOT used.
   * ============================================================
   */

  const STORAGE = {
    conversations: "ozlind:conversations",
    settings: "ozlind:chat-settings",
    instructions: "ozlind:custom-instructions",
    memory: "ozlind:memory",
    theme: "ozlind:theme",
    sidebar: "ozlind:sidebar-collapsed"
  };

  const LIMITS = {
    conversations: 100,
    messages: 100,
    messageChars: 12000,
    attachmentSize: 8 * 1024 * 1024,
    maxAttachments: 4,
    maxImageDimension: 1600,
    maxInstructions: 5000,
    historyFileSize: 10 * 1024 * 1024
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  /*
   * ============================================================
   * DOM
   * ============================================================
   */

  const body = document.body;

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
  const conversationSearchDrawer =
    $("#conversationSearchDrawer");

  const conversationList = $("#conversationList");
  const conversationListDrawer =
    $("#conversationListDrawer");

  const mobileNavBtn = $("#mobileNavBtn");
  const sidebarOverlay = $("#sidebarOverlay");
  const sidebarCollapse = $("#collapseBtn");

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

  const saveInstructionsBtn =
    $("#saveInstructionsBtn");

  const exportHistoryBtn =
    $("#exportHistoryBtn");

  const importHistoryBtn =
    $("#importHistoryBtn");

  const historyFileInput =
    $("#historyFileInput");

  const clearHistoryBtn =
    $("#clearHistoryBtn");

  const themeToggleDesktop =
    $("#themeToggleDesktop");

  const themeToggleMobile =
    $("#themeToggleMobile");

  const profileBtnTop =
    $("#profileBtnTop");

  const connectionStatus =
    $("#connectionStatus");

  const topbarTitle =
    $("#topbarTitle");

  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  let conversations = loadConversations();

  let activeConversationId =
    conversations[0]?.id || null;

  let pendingAttachments = [];

  let controller = null;
  let generating = false;

  let recognition = null;
  let listening = false;

  let currentView = "chat";

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  function createId(prefix = "id") {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }

    return (
      `${prefix}_${Date.now()}_` +
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
      const value =
        window.localStorage.getItem(key);

      return value === null
        ? fallback
        : value;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      window.localStorage.setItem(
        key,
        value
      );

      return true;
    } catch {
      toast(
        "Browser storage is full.",
        "error"
      );

      return false;
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }

  /*
   * ============================================================
   * TOAST
   * ============================================================
   */

  function toast(message, type = "info") {
    if (!toastStack) {
      console[type === "error" ? "error" : "log"](
        message
      );
      return;
    }

    const element =
      document.createElement("div");

    element.className =
      "toast" +
      (type === "error"
        ? " is-error"
        : "") +
      (type === "success"
        ? " is-success"
        : "");

    element.textContent = String(message);

    toastStack.appendChild(element);

    window.setTimeout(() => {
      element.remove();
    }, 3200);
  }

  /*
   * ============================================================
   * THEME
   * ============================================================
   */

  function getTheme() {
    return getStorage(
      STORAGE.theme,
      "dark"
    ) === "light"
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    const valid =
      theme === "light"
        ? "light"
        : "dark";

    body.dataset.theme = valid;

    setStorage(
      STORAGE.theme,
      valid
    );

    updateThemeButtons(valid);
  }

  function updateThemeButtons(theme) {
    const nextLabel =
      theme === "dark"
        ? "Switch to light theme"
        : "Switch to dark theme";

    [themeToggleDesktop, themeToggleMobile]
      .filter(Boolean)
      .forEach(button => {
        button.setAttribute(
          "aria-label",
          nextLabel
        );

        button.setAttribute(
          "title",
          nextLabel
        );

        const icon =
          $(".theme-icon", button);

        if (icon) {
          icon.textContent =
            theme === "dark"
              ? "☾"
              : "☀";
        }
      });
  }

  function toggleTheme() {
    applyTheme(
      getTheme() === "dark"
        ? "light"
        : "dark"
    );
  }

  /*
   * ============================================================
   * SETTINGS
   * ============================================================
   */

  function getSettings() {
    const saved =
      parseJSON(
        getStorage(
          STORAGE.settings,
          "{}"
        ),
        {}
      );

    return {
      responseLength:
        ["short", "medium", "long"].includes(
          saved.responseLength
        )
          ? saved.responseLength
          : "medium",

      responseStyle:
        [
          "balanced",
          "professional",
          "friendly",
          "direct",
          "creative"
        ].includes(
          saved.responseStyle
        )
          ? saved.responseStyle
          : "balanced"
    };
  }

  function loadSettings() {
    const settings =
      getSettings();

    if (responseLength) {
      responseLength.value =
        settings.responseLength;
    }

    if (responseStyle) {
      responseStyle.value =
        settings.responseStyle;
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
      const enabled =
        getStorage(
          STORAGE.memory,
          "true"
        ) !== "false";

      memoryToggle.setAttribute(
        "aria-checked",
        String(enabled)
      );
    }
  }

  function saveSettings() {
    const settings = {
      responseLength:
        ["short", "medium", "long"].includes(
          responseLength?.value
        )
          ? responseLength.value
          : "medium",

      responseStyle:
        [
          "balanced",
          "professional",
          "friendly",
          "direct",
          "creative"
        ].includes(
          responseStyle?.value
        )
          ? responseStyle.value
          : "balanced"
    };

    setStorage(
      STORAGE.settings,
      JSON.stringify(settings)
    );
  }

  function toggleMemory() {
    if (!memoryToggle) return;

    const current =
      memoryToggle.getAttribute(
        "aria-checked"
      ) === "true";

    const next = !current;

    memoryToggle.setAttribute(
      "aria-checked",
      String(next)
    );

    setStorage(
      STORAGE.memory,
      String(next)
    );

    toast(
      next
        ? "Memory enabled."
        : "Memory disabled.",
      "success"
    );
  }

  function saveCustomInstructions() {
    const value =
      String(
        customInstructions?.value || ""
      )
        .slice(
          0,
          LIMITS.maxInstructions
        );

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

  /*
   * ============================================================
   * CONVERSATIONS
   * ============================================================
   */

  function normalizeAttachment(
    attachment
  ) {
    if (
      !attachment ||
      typeof attachment !== "object" ||
      typeof attachment.dataUrl !== "string"
    ) {
      return null;
    }

    if (
      !/^data:image\//i.test(
        attachment.dataUrl
      )
    ) {
      return null;
    }

    return {
      name:
        typeof attachment.name === "string"
          ? attachment.name.slice(0, 200)
          : "image",

      type:
        typeof attachment.type === "string"
          ? attachment.type
          : "image/jpeg",

      dataUrl:
        attachment.dataUrl,

      width:
        Number.isFinite(attachment.width)
          ? attachment.width
          : undefined,

      height:
        Number.isFinite(attachment.height)
          ? attachment.height
          : undefined
    };
  }

  function normalizeMessage(message) {
    if (
      !message ||
      typeof message !== "object"
    ) {
      return null;
    }

    if (
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      return null;
    }

    const attachments =
      Array.isArray(message.attachments)
        ? message.attachments
            .map(normalizeAttachment)
            .filter(Boolean)
            .slice(
              0,
              LIMITS.maxAttachments
            )
        : [];

    return {
      id:
        typeof message.id === "string"
          ? message.id
          : createId("msg"),

      role:
        message.role,

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

      attachments,

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

    const messages =
      Array.isArray(item.messages)
        ? item.messages
            .map(normalizeMessage)
            .filter(Boolean)
            .slice(
              0,
              LIMITS.messages
            )
        : [];

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
        typeof item.createdAt === "string"
          ? item.createdAt
          : now(),

      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : now(),

      messages
    };
  }

  function loadConversations() {
    const data =
      parseJSON(
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
      .sort(sortConversations)
      .slice(
        0,
        LIMITS.conversations
      );
  }

  function sortConversations(a, b) {
    return (
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
    );
  }

  function saveConversations() {
    setStorage(
      STORAGE.conversations,
      JSON.stringify(conversations)
    );
  }

  function getActiveConversation() {
    return conversations.find(
      conversation =>
        conversation.id ===
        activeConversationId
    );
  }

  function createConversation() {
    const conversation = {
      id: createId("chat"),
      title: "New chat",
      createdAt: now(),
      updatedAt: now(),
      messages: []
    };

    conversations.unshift(
      conversation
    );

    conversations =
      conversations
        .sort(sortConversations)
        .slice(
          0,
          LIMITS.conversations
        );

    activeConversationId =
      conversation.id;

    saveConversations();

    renderConversationLists();
    renderMessages();

    return conversation;
  }

  function ensureConversation() {
    return (
      getActiveConversation() ||
      createConversation()
    );
  }

  function startNewChat() {
    if (generating) {
      toast(
        "Please stop the current response first.",
        "error"
      );
      return;
    }

    pendingAttachments = [];

    renderAttachments();

    createConversation();

    showView("chat");

    closeHistoryPanelUI();

    focusInput();
  }

  function makeConversationTitle(text) {
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
        title
          .slice(0, 60)
          .trim();
    }

    if (clean.length > title.length) {
      title += "…";
    }

    return title;
  }

  function updateConversation(
    conversation
  ) {
    conversation.updatedAt = now();

    conversations.sort(
      sortConversations
    );

    saveConversations();
  }

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   *
   * IMPORTANT:
   * index.html uses:
   *
   *   data-page="chat"
   *   data-page="history"
   *   etc.
   *
   * We therefore DO NOT depend on #chatView etc.
   */

  const VIEW_TITLES = {
    chat: "AI Chat",
    history: "History",
    research: "Research",
    vision: "Vision",
    settings: "Settings"
  };

  function showView(view) {
    const validViews = Object.keys(
      VIEW_TITLES
    );

    if (!validViews.includes(view)) {
      view = "chat";
    }

    currentView = view;

    $$(".view").forEach(element => {
      const active =
        element.dataset.page === view;

      element.classList.toggle(
        "is-active",
        active
      );

      element.setAttribute(
        "aria-hidden",
        String(!active)
      );
    });

    $$("[data-view]").forEach(
      element => {
        const active =
          element.dataset.view === view;

        element.classList.toggle(
          "is-active",
          active
        );

        if (
          element.classList.contains(
            "nav-item"
          )
        ) {
          if (active) {
            element.setAttribute(
              "aria-current",
              "page"
            );
          } else {
            element.removeAttribute(
              "aria-current"
            );
          }
        }
      }
    );

    if (topbarTitle) {
      topbarTitle.textContent =
        VIEW_TITLES[view];
    }

    closeMobileSidebar();

    if (view === "history") {
      renderConversationLists();
    }

    if (view === "settings") {
      loadSettings();
    }

    if (view === "chat") {
      renderMessages();
    }
  }

  /*
   * ============================================================
   * MOBILE / SIDEBAR
   * ============================================================
   */

  function toggleMobileSidebar() {
    body.classList.toggle(
      "sidebar-open"
    );

    updateSidebarAccessibility();
  }

  function closeMobileSidebar() {
    body.classList.remove(
      "sidebar-open"
    );

    updateSidebarAccessibility();
  }

  function toggleSidebarCollapse() {
    body.classList.toggle(
      "sidebar-collapsed"
    );

    const collapsed =
      body.classList.contains(
        "sidebar-collapsed"
      );

    setStorage(
      STORAGE.sidebar,
      String(collapsed)
    );

    updateCollapseButton();
  }

  function loadSidebarState() {
    const collapsed =
      getStorage(
        STORAGE.sidebar,
        "false"
      ) === "true";

    body.classList.toggle(
      "sidebar-collapsed",
      collapsed
    );

    updateCollapseButton();
  }

  function updateCollapseButton() {
    if (!sidebarCollapse) return;

    const collapsed =
      body.classList.contains(
        "sidebar-collapsed"
      );

    sidebarCollapse.setAttribute(
      "aria-label",
      collapsed
        ? "Expand sidebar"
        : "Collapse sidebar"
    );

    sidebarCollapse.setAttribute(
      "title",
      collapsed
        ? "Expand sidebar"
        : "Collapse sidebar"
    );

    const icon =
      $("span", sidebarCollapse);

    if (icon) {
      icon.textContent =
        collapsed ? "›" : "‹";
    }
  }

  function updateSidebarAccessibility() {
    if (!sidebarOverlay) return;

    sidebarOverlay.setAttribute(
      "aria-hidden",
      String(
        !body.classList.contains(
          "sidebar-open"
        )
      )
    );
  }

  /*
   * ============================================================
   * HISTORY
   * ============================================================
   */

  function formatDate(value) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const today =
      new Date();

    if (
      date.toDateString() ===
      today.toDateString()
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

  function renderConversationLists(
    filter = ""
  ) {
    renderConversationList(
      conversationList,
      filter
    );

    renderConversationList(
      conversationListDrawer,
      filter
    );
  }

  function renderConversationList(
    container,
    filter = ""
  ) {
    if (!container) return;

    const query =
      String(filter || "")
        .trim()
        .toLowerCase();

    const list =
      conversations.filter(
        conversation => {
          if (!query) {
            return true;
          }

          return (
            conversation.title
              .toLowerCase()
              .includes(query) ||
            conversation.messages.some(
              message =>
                message.content
                  .toLowerCase()
                  .includes(query)
            )
          );
        }
      );

    container.innerHTML = "";

    if (!list.length) {
      const empty =
        document.createElement("div");

      empty.className =
        "conversation-empty";

      empty.textContent =
        query
          ? "No conversations found."
          : "No conversations yet.";

      container.appendChild(empty);

      return;
    }

    list.forEach(
      conversation => {
        const item =
          document.createElement("div");

        item.className =
          "conversation-item" +
          (
            conversation.id ===
            activeConversationId
              ? " is-active"
              : ""
          );

        const main =
          document.createElement("button");

        main.type = "button";
        main.className =
          "conversation-main";

        main.innerHTML = `
          <span class="conversation-title">
            ${escapeHTML(
              conversation.title
            )}
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

            showView("chat");

            renderMessages();

            closeHistoryPanelUI();

            focusInput();
          }
        );

        const deleteBtn =
          document.createElement("button");

        deleteBtn.type = "button";
        deleteBtn.className =
          "conversation-delete";

        deleteBtn.textContent = "×";

        deleteBtn.setAttribute(
          "aria-label",
          "Delete conversation"
        );

        deleteBtn.title =
          "Delete conversation";

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

        container.appendChild(item);
      }
    );
  }

  function deleteConversation(
    conversationId
  ) {
    const conversation =
      conversations.find(
        item =>
          item.id ===
          conversationId
      );

    if (!conversation) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${conversation.title}"?`
      );

    if (!confirmed) {
      return;
    }

    conversations =
      conversations.filter(
        item =>
          item.id !==
          conversationId
      );

    if (
      activeConversationId ===
      conversationId
    ) {
      activeConversationId =
        conversations[0]?.id ||
        null;
    }

    saveConversations();

    renderConversationLists();
    renderMessages();

    toast(
      "Conversation deleted.",
      "success"
    );
  }

  /*
   * ============================================================
   * HISTORY DRAWER
   * ============================================================
   */

  function openHistoryPanelUI() {
    if (!chatHistoryPanel) return;

    chatHistoryPanel.classList.add(
      "is-open"
    );

    chatHistoryPanel.setAttribute(
      "aria-hidden",
      "false"
    );

    renderConversationList(
      conversationListDrawer,
      conversationSearchDrawer?.value ||
        ""
    );
  }

  function closeHistoryPanelUI() {
    if (!chatHistoryPanel) return;

    chatHistoryPanel.classList.remove(
      "is-open"
    );

    chatHistoryPanel.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  /*
   * ============================================================
   * MARKDOWN
   * ============================================================
   */

  function markdown(text) {
    let html =
      escapeHTML(text || "");

    const codeBlocks = [];

    html = html.replace(
      /```(?:[a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g,
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
      /\*([^*\n]+)\*/g,
      "<em>$1</em>"
    );

    html = html.replace(
      /`([^`\n]+)`/g,
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

    html = html.replace(
      /\n/g,
      "<br>"
    );

    html =
      "<p>" +
      html +
      "</p>";

    html = html.replace(
      /<p>\s*(<h[1-3]>)/g,
      "$1"
    );

    html = html.replace(
      /(<\/h[1-3]>)\s*<\/p>/g,
      "$1"
    );

    html = html.replace(
      /<p>\s*(<ul>)/g,
      "$1"
    );

    html = html.replace(
      /(<\/ul>)\s*<\/p>/g,
      "$1"
    );

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

  /*
   * ============================================================
   * MESSAGE RENDERING
   * ============================================================
   */

  function messageAvatar(role) {
    return role === "user"
      ? "You"
      : "O";
  }

  function renderMessages() {
    if (!chatMessages) return;

    const conversation =
      getActiveConversation();

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
          document.createElement(
            "article"
          );

        element.className =
          `message message--${message.role}`;

        element.dataset.id =
          message.id;

        const attachmentHTML =
          Array.isArray(
            message.attachments
          ) &&
          message.attachments.length
            ? `
              <div class="message-attachments">
                ${message.attachments
                  .map(
                    attachment => `
                      <img
                        src="${escapeHTML(
                          attachment.dataUrl
                        )}"
                        alt="${escapeHTML(
                          attachment.name ||
                          "Attached image"
                        )}"
                        loading="lazy"
                      >
                    `
                  )
                  .join("")}
              </div>
            `
            : "";

        const actions =
          message.role === "assistant"
            ? `
              <button
                class="message-action"
                type="button"
                data-action="copy"
                title="Copy"
                aria-label="Copy response">
                ⧉
              </button>

              <button
                class="message-action"
                type="button"
                data-action="regenerate"
                title="Regenerate"
                aria-label="Regenerate response">
                ↻
              </button>

              <button
                class="message-action ${
                  message.feedback === "like"
                    ? "is-active"
                    : ""
                }"
                type="button"
                data-action="like"
                title="Helpful"
                aria-label="Helpful">
                ↑
              </button>

              <button
                class="message-action ${
                  message.feedback === "dislike"
                    ? "is-active"
                    : ""
                }"
                type="button"
                data-action="dislike"
                title="Not helpful"
                aria-label="Not helpful">
                ↓
              </button>
            `
            : `
              <button
                class="message-action"
                type="button"
                data-action="edit"
                title="Edit"
                aria-label="Edit message">
                ✎
              </button>

              <button
                class="message-action"
                type="button"
                data-action="copy"
                title="Copy"
                aria-label="Copy message">
                ⧉
              </button>
            `;

        element.innerHTML = `
          <div class="message-avatar">
            ${messageAvatar(
              message.role
            )}
          </div>

          <div class="message-content">

            <div class="message-role">
              ${
                message.role === "user"
                  ? "You"
                  : "Ozlind AI"
              }
            </div>

            ${
              attachmentHTML
            }

            <div class="message-text">
              ${
                message.content
                  ? markdown(
                      message.content
                    )
                  : `
                    <span class="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  `
              }
            </div>

            <div class="message-actions">
              ${actions}
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

  /*
   * ============================================================
   * MESSAGE ACTIONS
   * ============================================================
   */

  async function copyText(text) {
    const value =
      String(text || "");

    if (!value) {
      toast(
        "Nothing to copy.",
        "error"
      );
      return;
    }

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          value
        );
      } else {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value = value;
        textarea.style.position =
          "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(
          textarea
        );

        textarea.select();

        document.execCommand(
          "copy"
        );

        textarea.remove();
      }

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
      getActiveConversation();

    if (!conversation) return;

    const index =
      conversation.messages.findIndex(
        message =>
          message.id ===
          messageId
      );

    if (index === -1) return;

    const message =
      conversation.messages[index];

    if (action === "copy") {
      copyText(
        message.content
      );
      return;
    }

    if (
      action === "like" ||
      action === "dislike"
    ) {
      message.feedback =
        message.feedback === action
          ? null
          : action;

      saveConversations();
      renderMessages();

      return;
    }

    if (action === "edit") {
      if (
        message.role !== "user"
      ) {
        return;
      }

      if (generating) {
        toast(
          "Please stop generation first.",
          "error"
        );
        return;
      }

      chatInput.value =
        message.content;

      pendingAttachments =
        Array.isArray(
          message.attachments
        )
          ? [...message.attachments]
          : [];

      conversation.messages.splice(
        index
      );

      updateConversation(
        conversation
      );

      renderAttachments();
      renderMessages();

      showView("chat");
      focusInput();

      return;
    }

    if (
      action === "regenerate"
    ) {
      regenerateFrom(
        messageId
      );
    }
  }

  async function regenerateFrom(
    assistantMessageId
  ) {
    if (generating) {
      return;
    }

    const conversation =
      getActiveConversation();

    if (!conversation) {
      return;
    }

    const assistantIndex =
      conversation.messages.findIndex(
        message =>
          message.id ===
          assistantMessageId
      );

    if (
      assistantIndex === -1
    ) {
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
      toast(
        "Unable to regenerate this response.",
        "error"
      );
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

  /*
   * ============================================================
   * ATTACHMENTS
   * ============================================================
   */

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
          <span
            title="${escapeHTML(
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
            title="Remove attachment">
            ×
          </button>
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

        reader.onerror = () => {
          reject(
            new Error(
              "Could not read image."
            )
          );
        };

        reader.onload = () => {
          const image =
            new Image();

          image.onerror = () => {
            reject(
              new Error(
                "Invalid image."
              )
            );
          };

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
              Math.max(
                1,
                Math.round(
                  width * scale
                )
              );

            height =
              Math.max(
                1,
                Math.round(
                  height * scale
                )
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

            if (!ctx) {
              reject(
                new Error(
                  "Image processing is unavailable."
                )
              );
              return;
            }

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

  async function handleFiles(
    fileList
  ) {
    const incoming =
      Array.from(
        fileList || []
      );

    if (!incoming.length) {
      return;
    }

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
        const processed =
          await resizeImage(file);

        pendingAttachments.push({
          name: file.name,
          type:
            file.type ||
            "image/jpeg",
          dataUrl:
            processed.dataUrl,
          width:
            processed.width,
          height:
            processed.height
        });
      } catch (error) {
        console.error(
          "Image processing:",
          error
        );

        toast(
          `Could not process ${file.name}.`,
          "error"
        );
      }
    }

    renderAttachments();
  }

  /*
   * ============================================================
   * VOICE
   * ============================================================
   */

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
    };

    recognition.onresult = event => {
      let text = "";

      for (
        let index =
          event.resultIndex;
        index <
        event.results.length;
        index++
      ) {
        text +=
          event.results[index][0]
            .transcript;
      }

      if (chatInput) {
        chatInput.value =
          text.trim();

        autoResizeInput();
      }
    };

    recognition.onerror = event => {
      listening = false;

      voiceBtn?.classList.remove(
        "is-active"
      );

      if (
        event.error !==
        "aborted"
      ) {
        toast(
          "Voice input failed.",
          "error"
        );
      }
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

    try {
      if (listening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } catch (error) {
      console.error(
        "Voice:",
        error
      );
    }
  }

  /*
   * ============================================================
   * API PAYLOAD
   * ============================================================
   */

  function buildApiMessages(
    conversation
  ) {
    return conversation.messages
      .slice(-20)
      .map(message => {
        const hasImages =
          Array.isArray(
            message.attachments
          ) &&
          message.attachments.length;

        if (hasImages) {
          return {
            role: message.role,

            content: [
              ...(message.content
                ? [
                    {
                      type: "text",
                      text:
                        message.content
                    }
                  ]
                : []),

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
    const settings =
      getSettings();

    return {
      messages:
        buildApiMessages(
          conversation
        ),

      model:
        mode || "auto",

      mode:
        mode || "auto",

      research:
        Boolean(research),

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
        settings.responseLength,

      responseStyle:
        settings.responseStyle
    };
  }

  /*
   * ============================================================
   * SSE RESPONSE READER
   * ============================================================
   */

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
        data?.choices?.[0]
          ?.message?.content ||
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
      const result =
        await reader.read();

      if (result.done) {
        break;
      }

      buffer += decoder.decode(
        result.value,
        {
          stream: true
        }
      );

      const lines =
        buffer.split(/\r?\n/);

      buffer =
        lines.pop() || "";

      for (
        const rawLine of lines
      ) {
        const line =
          rawLine.trim();

        if (!line) {
          continue;
        }

        if (
          !line.startsWith(
            "data:"
          )
        ) {
          continue;
        }

        const payload =
          line
            .slice(5)
            .trim();

        if (
          payload ===
          "[DONE]"
        ) {
          continue;
        }

        try {
          const data =
            JSON.parse(
              payload
            );

          /*
           * Backend first sends provider/model
           * metadata. It does NOT contain text.
           */

          const token =
            data?.choices?.[0]
              ?.delta?.content ??
            data?.choices?.[0]
              ?.message?.content ??
            data?.token ??
            data?.content ??
            "";

          if (
            typeof token === "string" &&
            token
          ) {
            fullText += token;

            onToken(token);
          }
        } catch {
          /*
           * Ignore malformed/non-JSON
           * SSE metadata safely.
           */
        }
      }
    }

    /*
     * Flush decoder.
     */

    buffer +=
      decoder.decode();

    return fullText;
  }

  /*
   * ============================================================
   * CONNECTION STATUS
   * ============================================================
   */

  function setConnectionState(
    state,
    text
  ) {
    if (!connectionStatus) {
      return;
    }

    const label =
      connectionStatus.querySelector(
        "span:last-child"
      );

    if (label) {
      label.textContent =
        text;
    }

    connectionStatus.dataset.state =
      state;

    const indicator =
      connectionStatus.querySelector(
        ".status-indicator"
      );

    if (indicator) {
      indicator.classList.toggle(
        "is-error",
        state === "error"
      );

      indicator.classList.toggle(
        "is-active",
        state === "busy"
      );
    }
  }

  /*
   * ============================================================
   * SEND MESSAGE
   * ============================================================
   */

  async function sendMessage(
    text,
    attachments = [],
    regenerate = false
  ) {
    if (generating) {
      return;
    }

    const clean =
      String(text || "")
        .trim();

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
        id: createId("msg"),
        role: "user",
        content: clean,
        createdAt: now(),
        attachments:
          attachments.map(
            attachment => ({
              ...attachment
            })
          )
      });

      /*
       * Set title only for first user message.
       */

      const userMessages =
        conversation.messages.filter(
          message =>
            message.role ===
            "user"
        );

      if (
        userMessages.length === 1
      ) {
        conversation.title =
          makeConversationTitle(
            clean ||
              attachments[0]?.name ||
              "Image"
          );
      }
    }

    updateConversation(
      conversation
    );

    pendingAttachments = [];

    renderAttachments();
    renderMessages();

    if (chatInput) {
      chatInput.value = "";
      autoResizeInput();
    }

    generating = true;

    controller =
      new AbortController();

    setGeneratingUI(true);

    const assistant = {
      id: createId("msg"),
      role: "assistant",
      content: "",
      createdAt: now(),
      attachments: [],
      feedback: null
    };

    conversation.messages.push(
      assistant
    );

    saveConversations();

    renderMessages();

    const assistantElement =
      () =>
        $(
          `.message[data-id="${assistant.id}"] .message-text`
        );

    try {
      const mode =
        [
          "auto",
          "fast",
          "smart",
          "research",
          "code",
          "write"
        ].includes(
          modelSelect?.value
        )
          ? modelSelect.value
          : "auto";

      const research =
        (
          researchToggle?.getAttribute(
            "aria-pressed"
          ) === "true"
        ) ||
        mode === "research";

      const payload =
        buildRequest(
          conversation,
          mode,
          research
        );

      setConnectionState(
        "busy",
        "Thinking…"
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

        throw new Error(
          message
        );
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

      /*
       * Successful but empty response.
       */

      if (
        !assistant.content.trim()
      ) {
        assistant.content =
          "I couldn't generate a response.";
      }

      updateConversation(
        conversation
      );

      renderMessages();

      setConnectionState(
        "ready",
        "Ready"
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        conversation.messages =
          conversation.messages.filter(
            message =>
              message.id !==
              assistant.id
          );

        saveConversations();
        renderMessages();

        setConnectionState(
          "ready",
          "Ready"
        );

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
          message =>
            message.id !==
            assistant.id
        );

      saveConversations();
      renderMessages();

      setConnectionState(
        "error",
        "Connection error"
      );

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

  /*
   * ============================================================
   * GENERATION UI
   * ============================================================
   */

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
        active ||
        !recognition;
    }

    if (!active) {
      setConnectionState(
        "ready",
        "Ready"
      );
    }
  }

  function stopGeneration() {
    if (!controller) {
      return;
    }

    controller.abort();
  }

  /*
   * ============================================================
   * INPUT
   * ============================================================
   */

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
    window.setTimeout(
      () => {
        if (
          currentView ===
          "chat"
        ) {
          chatInput?.focus();
        }
      },
      50
    );
  }

  function submitChat() {
    if (generating) {
      return;
    }

    const text =
      chatInput?.value || "";

    sendMessage(
      text,
      [...pendingAttachments]
    );
  }

  /*
   * ============================================================
   * RESEARCH
   * ============================================================
   */

  function setResearchEnabled(
    enabled
  ) {
    if (!researchToggle) {
      return;
    }

    researchToggle.setAttribute(
      "aria-pressed",
      String(enabled)
    );

    researchToggle.classList.toggle(
      "is-active",
      enabled
    );
  }

  function toggleResearch() {
    if (!researchToggle) {
      return;
    }

    const current =
      researchToggle.getAttribute(
        "aria-pressed"
      ) === "true";

    const next = !current;

    setResearchEnabled(
      next
    );

    if (modelSelect) {
      if (next) {
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

  function startResearchMode() {
    showView("chat");

    if (modelSelect) {
      modelSelect.value =
        "research";
    }

    setResearchEnabled(
      true
    );

    focusInput();
  }

  function startVisionMode() {
    showView("chat");

    if (modelSelect) {
      modelSelect.value =
        "smart";
    }

    window.setTimeout(
      () => {
        fileInput?.click();
      },
      100
    );

    focusInput();
  }

  /*
   * ============================================================
   * MODAL
   * ============================================================
   */

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

    modalOverlay.setAttribute(
      "aria-hidden",
      "false"
    );

    modal?.focus();
  }

  function closeModal() {
    if (!modalOverlay) {
      return;
    }

    modalOverlay.classList.remove(
      "is-open"
    );

    modalOverlay.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  /*
   * ============================================================
   * IMPORT / EXPORT
   * ============================================================
   */

  function exportHistory() {
    const payload = {
      app: "Ozlind",
      version: 2,
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

    window.setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      1000
    );

    toast(
      "Chat history exported.",
      "success"
    );
  }

  async function importHistory(
    file
  ) {
    if (!file) {
      return;
    }

    if (
      file.size >
      LIMITS.historyFileSize
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
          data?.conversations
        )
          ? data.conversations
          : Array.isArray(data)
            ? data
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
            conversation => [
              conversation.id,
              conversation
            ]
          )
        );

      normalized.forEach(
        conversation => {
          existing.set(
            conversation.id,
            conversation
          );
        }
      );

      conversations =
        Array.from(
          existing.values()
        )
          .sort(sortConversations)
          .slice(
            0,
            LIMITS.conversations
          );

      activeConversationId =
        conversations[0]?.id ||
        null;

      saveConversations();

      renderConversationLists();
      renderMessages();

      toast(
        "Chat history imported.",
        "success"
      );
    } catch (error) {
      console.error(
        "Import:",
        error
      );

      toast(
        error?.message ||
          "Invalid history file.",
        "error"
      );
    }
  }

  function clearHistory() {
    if (!conversations.length) {
      toast(
        "History is already empty."
      );
      return;
    }

    if (generating) {
      toast(
        "Stop generation before clearing history.",
        "error"
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Delete all conversations?"
      );

    if (!confirmed) {
      return;
    }

    conversations = [];

    activeConversationId =
      null;

    saveConversations();

    createConversation();

    toast(
      "All conversations deleted.",
      "success"
    );
  }

  /*
   * ============================================================
   * EVENT HELPERS
   * ============================================================
   */

  function bindNavigation() {
    document.addEventListener(
      "click",
      event => {
        const target =
          event.target.closest(
            "[data-view]"
          );

        if (!target) {
          return;
        }

        /*
         * Ignore dynamic message actions.
         */

        if (
          target.closest(
            ".message"
          )
        ) {
          return;
        }

        const view =
          target.dataset.view;

        if (!view) {
          return;
        }

        event.preventDefault();

        if (
          target.dataset.research ===
          "true"
        ) {
          startResearchMode();
          return;
        }

        if (
          target.dataset.focusAttach ===
          "true"
        ) {
          startVisionMode();
          return;
        }

        showView(view);
      }
    );
  }

  function bindEvents() {
    /*
     * Navigation
     */

    bindNavigation();

    /*
     * New chat
     */

    newChatBtn?.addEventListener(
      "click",
      startNewChat
    );

    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            '[data-action="new-chat"]'
          );

        if (!button) {
          return;
        }

        event.preventDefault();

        startNewChat();
      }
    );

    /*
     * Mobile sidebar
     */

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

    /*
     * Chat form
     *
     * IMPORTANT:
     * We intentionally do NOT attach a
     * second click handler to sendBtn.
     * Otherwise type="submit" could
     * trigger the request twice.
     */

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

    stopBtn?.addEventListener(
      "click",
      stopGeneration
    );

    /*
     * Research
     */

    researchToggle?.addEventListener(
      "click",
      toggleResearch
    );

    /*
     * Attachments
     */

    attachBtn?.addEventListener(
      "click",
      () => {
        if (!generating) {
          fileInput?.click();
        }
      }
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

        if (!button) {
          return;
        }

        const index =
          Number(
            button.dataset.index
          );

        if (
          Number.isInteger(index) &&
          index >= 0
        ) {
          pendingAttachments.splice(
            index,
            1
          );

          renderAttachments();
        }
      }
    );

    /*
     * Paste images
     */

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

    /*
     * Drag & drop
     */

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

    /*
     * Voice
     */

    voiceBtn?.addEventListener(
      "click",
      toggleVoice
    );

    /*
     * History search
     */

    conversationSearch?.addEventListener(
      "input",
      event => {
        renderConversationList(
          conversationList,
          event.target.value
        );
      }
    );

    conversationSearchDrawer?.addEventListener(
      "input",
      event => {
        renderConversationList(
          conversationListDrawer,
          event.target.value
        );
      }
    );

    /*
     * History drawer
     */

    closeHistoryPanel?.addEventListener(
      "click",
      closeHistoryPanelUI
    );

    /*
     * Existing chat history
     * button support if another
     * compatible button is added later.
     */

    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "#historyToggleBtn, #chatHistoryBtn, #chatHistoryBtn2"
          );

        if (!button) {
          return;
        }

        event.preventDefault();

        openHistoryPanelUI();
      }
    );

    /*
     * Chat settings
     */

    $("#chatSettingsBtn")
      ?.addEventListener(
        "click",
        () => {
          showView(
            "settings"
          );
        }
      );

    /*
     * Settings
     */

    memoryToggle?.addEventListener(
      "click",
      toggleMemory
    );

    responseLength?.addEventListener(
      "change",
      () => {
        saveSettings();

        toast(
          "Response length updated.",
          "success"
        );
      }
    );

    responseStyle?.addEventListener(
      "change",
      () => {
        saveSettings();

        toast(
          "Response style updated.",
          "success"
        );
      }
    );

    saveInstructionsBtn?.addEventListener(
      "click",
      saveCustomInstructions
    );

    /*
     * Theme
     */

    themeToggleDesktop?.addEventListener(
      "click",
      toggleTheme
    );

    themeToggleMobile?.addEventListener(
      "click",
      toggleTheme
    );

    /*
     * Profile/settings buttons
     */

    profileBtnTop?.addEventListener(
      "click",
      () => {
        showView("settings");
      }
    );

    /*
     * Export / import
     */

    exportHistoryBtn?.addEventListener(
      "click",
      exportHistory
    );

    importHistoryBtn?.addEventListener(
      "click",
      () => {
        historyFileInput?.click();
      }
    );

    historyFileInput?.addEventListener(
      "change",
      event => {
        importHistory(
          event.target.files?.[0]
        );

        event.target.value = "";
      }
    );

    clearHistoryBtn?.addEventListener(
      "click",
      clearHistory
    );

    /*
     * Modal
     */

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

    /*
     * Keyboard shortcuts
     */

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
          "Escape"
        ) {
          closeModal();

          closeHistoryPanelUI();

          closeMobileSidebar();
        }
      }
    );

    /*
     * Message actions
     */

    chatMessages?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) {
          return;
        }

        const message =
          button.closest(
            ".message"
          );

        if (!message) {
          return;
        }

        handleMessageAction(
          button.dataset.action,
          message.dataset.id
        );
      }
    );

    /*
     * Suggestions
     */

    $$(".suggestion-card").forEach(
      card => {
        card.addEventListener(
          "click",
          () => {
            const prompt =
              card.dataset.prompt;

            if (!prompt) {
              return;
            }

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
  }

  /*
   * ============================================================
   * INIT
   * ============================================================
   */

  function init() {
    /*
     * Theme
     */

    applyTheme(
      getTheme()
    );

    /*
     * Settings
     */

    loadSettings();

    /*
     * Sidebar
     */

    loadSidebarState();

    /*
     * Voice
     */

    setupVoice();

    /*
     * Events
     */

    bindEvents();

    /*
     * Conversation
     */

    if (!conversations.length) {
      createConversation();
    } else {
      /*
       * Make sure active ID still exists.
       */

      if (
        !getActiveConversation()
      ) {
        activeConversationId =
          conversations[0]?.id ||
          null;
      }

      renderConversationLists();
      renderMessages();
    }

    /*
     * Initial view
     */

    showView("chat");

    /*
     * Composer
     */

    autoResizeInput();

    /*
     * Connection
     */

    setConnectionState(
      "ready",
      "Ready"
    );

    /*
     * Accessibility
     */

    updateSidebarAccessibility();
    updateCollapseButton();

    /*
     * Initial attachment render
     */

    renderAttachments();

    /*
     * Focus
     */

    focusInput();
  }

  /*
   * ============================================================
   * START
   * ============================================================
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
