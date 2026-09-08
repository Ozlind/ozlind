(() => {
  "use strict";

  /* =========================================================
     OZLIND AI CHAT
     - Local conversation history
     - Real /api/chat backend
     - Streaming response support
     - Image attachments
     - Voice input
     - Search/research toggle
     - Custom instructions
     - Memory toggle
     - Response length/style
     - Import/export history
     - Edit/regenerate/delete/copy/feedback
     - Theme integration
     - Safer storage handling
     - Robust SSE parsing
     - Safer markdown rendering
     ========================================================= */

  const STORAGE = {
    conversations: "ozlind:conversations",
    settings: "ozlind:chat-settings",
    customInstructions: "ozlind:custom-instructions",
    memory: "ozlind:memory",
    theme: "ozlind:theme"
  };

  const LIMITS = {
    maxConversations: 100,
    maxMessagesPerConversation: 100,
    maxMessageChars: 12000,
    maxTotalChars: 60000,
    maxAttachmentSize: 8 * 1024 * 1024,
    maxAttachmentDimension: 1600,
    maxAttachments: 4,
    maxHistoryFileSize: 10 * 1024 * 1024,
    maxCustomInstructions: 5000
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
  const chatSettingsBtn = $("#chatSettingsBtn");

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

  const modalOverlay = $("#modalOverlay");
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalClose = $("#modalClose");

  const toastStack = $("#toastStack");

  /* =========================================================
     STATE
     ========================================================= */

  let conversations = loadConversations();
  let activeConversationId = null;

  let pendingAttachments = [];

  let abortController = null;
  let isGenerating = false;

  let recognition = null;
  let isListening = false;

  let chatSettings = loadSettings();

  /* =========================================================
     UTILITIES
     ========================================================= */

  function createId(prefix = "id") {
    try {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        return `${prefix}_${window.crypto.randomUUID()}`;
      }
    } catch {
      // Fall back below.
    }

    return `${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
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

  function safeJSONParse(value, fallback) {
    if (typeof value !== "string" || !value) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  /* =========================================================
     SAFE STORAGE
     ========================================================= */

  function storageGet(key, fallback = null) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch (error) {
      console.warn("OZLIND storage read failed:", error);
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("OZLIND storage write failed:", error);

      toast(
        "Browser storage is unavailable or full.",
        "error"
      );

      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn("OZLIND storage remove failed:", error);
      return false;
    }
  }

  function toast(message, type = "info") {
    if (!toastStack) return;

    const item = document.createElement("div");

    item.className =
      `toast${type === "error" ? " toast--error" : ""}`;

    item.textContent = String(message || "");

    toastStack.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add("toast--show");
    });

    window.setTimeout(() => {
      item.classList.remove("toast--show");

      window.setTimeout(() => {
        item.remove();
      }, 250);
    }, 3200);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return formatTime(timestamp);
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  }

  function debounce(fn, delay = 250) {
    let timer = null;

    return (...args) => {
      clearTimeout(timer);

      timer = window.setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }

  function getValidDateValue(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return now();
    }

    return date.toISOString();
  }

  /* =========================================================
     STORAGE NORMALIZATION
     ========================================================= */

  function normalizeMessage(message) {
    if (!message || typeof message !== "object") {
      return null;
    }

    const role =
      message.role === "assistant" ||
      message.role === "user"
        ? message.role
        : null;

    if (!role) {
      return null;
    }

    const content =
      typeof message.content === "string"
        ? message.content.slice(0, LIMITS.maxMessageChars)
        : "";

    const attachments = Array.isArray(message.attachments)
      ? message.attachments
          .filter(
            attachment =>
              attachment &&
              typeof attachment === "object" &&
              typeof attachment.dataUrl === "string"
          )
          .slice(0, LIMITS.maxAttachments)
          .map(attachment => ({
            name:
              typeof attachment.name === "string"
                ? attachment.name.slice(0, 200)
                : "Attached image",

            type:
              typeof attachment.type === "string"
                ? attachment.type
                : "image/jpeg",

            dataUrl: attachment.dataUrl,

            width:
              Number.isFinite(attachment.width)
                ? attachment.width
                : undefined,

            height:
              Number.isFinite(attachment.height)
                ? attachment.height
                : undefined
          }))
      : [];

    if (!content && role === "user" && !attachments.length) {
      return null;
    }

    return {
      id:
        typeof message.id === "string"
          ? message.id
          : createId("msg"),

      role,

      content,

      createdAt: getValidDateValue(
        message.createdAt || now()
      ),

      attachments,

      feedback:
        message.feedback === "like" ||
        message.feedback === "dislike"
          ? message.feedback
          : null
    };
  }

  function normalizeConversation(conversation) {
    if (!conversation || typeof conversation !== "object") {
      return null;
    }

    if (typeof conversation.id !== "string") {
      return null;
    }

    const messages = Array.isArray(conversation.messages)
      ? conversation.messages
          .map(normalizeMessage)
          .filter(Boolean)
          .slice(0, LIMITS.maxMessagesPerConversation)
      : [];

    return {
      id: conversation.id,

      title:
        typeof conversation.title === "string"
          ? conversation.title
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 100) || "New chat"
          : "New chat",

      createdAt: getValidDateValue(
        conversation.createdAt || now()
      ),

      updatedAt: getValidDateValue(
        conversation.updatedAt ||
          conversation.createdAt ||
          now()
      ),

      messages
    };
  }

  function loadConversations() {
    const raw = storageGet(
      STORAGE.conversations,
      ""
    );

    if (!raw) {
      return [];
    }

    const parsed = safeJSONParse(raw, []);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeConversation)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      )
      .slice(0, LIMITS.maxConversations);
  }

  function saveConversations() {
    try {
      const cleaned = conversations
        .map(normalizeConversation)
        .filter(Boolean)
        .slice(0, LIMITS.maxConversations);

      const serialized = JSON.stringify(cleaned);

      storageSet(
        STORAGE.conversations,
        serialized
      );
    } catch (error) {
      console.error(
        "Unable to save conversations:",
        error
      );

      toast(
        "Chat history could not be saved.",
        "error"
      );
    }
  }

  function loadSettings() {
    const defaults = {
      responseLength: "balanced",
      responseStyle: "professional"
    };

    const parsed = safeJSONParse(
      storageGet(STORAGE.settings, "{}"),
      {}
    );

    return {
      responseLength:
        ["short", "balanced", "detailed"].includes(
          parsed.responseLength
        )
          ? parsed.responseLength
          : defaults.responseLength,

      responseStyle:
        [
          "professional",
          "friendly",
          "concise",
          "technical"
        ].includes(parsed.responseStyle)
          ? parsed.responseStyle
          : defaults.responseStyle
    };
  }

  function saveSettings() {
    storageSet(
      STORAGE.settings,
      JSON.stringify(chatSettings)
    );
  }

  function getCustomInstructions() {
    return storageGet(
      STORAGE.customInstructions,
      ""
    ).slice(0, LIMITS.maxCustomInstructions);
  }

  function getMemoryEnabled() {
    return (
      storageGet(STORAGE.memory, "true") !== "false"
    );
  }

  /* =========================================================
     CONVERSATIONS
     ========================================================= */

  function getActiveConversation() {
    return conversations.find(
      conversation =>
        conversation.id === activeConversationId
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

    conversations.unshift(conversation);

    conversations = conversations.slice(
      0,
      LIMITS.maxConversations
    );

    activeConversationId = conversation.id;

    saveConversations();
    renderConversationList();
    renderMessages();

    return conversation;
  }

  function ensureConversation() {
    return (
      getActiveConversation() ||
      createConversation()
    );
  }

  function updateConversationTimestamp(
    conversation
  ) {
    conversation.updatedAt = now();

    conversations.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );
  }

  function generateConversationTitle(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      return "New chat";
    }

    const words = clean.split(" ");

    let title = words
      .slice(0, 8)
      .join(" ");

    if (title.length > 55) {
      title = title.slice(0, 55).trim();
    }

    if (
      words.length > 8 ||
      clean.length > title.length
    ) {
      title += "…";
    }

    return title;
  }

  function selectConversation(id) {
    const conversation = conversations.find(
      item => item.id === id
    );

    if (!conversation) {
      return;
    }

    activeConversationId = id;

    renderConversationList();
    renderMessages();

    closeHistory();
  }

  function deleteConversation(id) {
    const index = conversations.findIndex(
      conversation =>
        conversation.id === id
    );

    if (index === -1) {
      return;
    }

    const conversation = conversations[index];

    const confirmed = window.confirm(
      `Delete "${conversation.title}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    conversations.splice(index, 1);

    if (
      activeConversationId === id
    ) {
      activeConversationId =
        conversations[0]?.id || null;
    }

    saveConversations();
    renderConversationList();
    renderMessages();

    toast("Conversation deleted.");
  }

  function renameConversation(
    conversation,
    title
  ) {
    if (!conversation) return;

    const clean = String(title || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    if (!clean) {
      return;
    }

    conversation.title = clean;
    conversation.updatedAt = now();

    saveConversations();
    renderConversationList();
  }

  /* =========================================================
     MARKDOWN
     ========================================================= */

  function renderMarkdownSafe(source) {
    let text = escapeHTML(source);

    const codeBlocks = [];

    /*
     * Extract fenced code blocks before processing
     * any other markdown.
     */
    text = text.replace(
      /```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g,
      (_, language, code) => {
        const index = codeBlocks.length;

        codeBlocks.push({
          language: language || "",
          code
        });

        return `@@CODEBLOCK_${index}@@`;
      }
    );

    /*
     * Inline code.
     */
    text = text.replace(
      /`([^`\n]+)`/g,
      "<code>$1</code>"
    );

    /*
     * Headings.
     */
    text = text.replace(
      /^###[ \t]+(.+)$/gm,
      "<h4>$1</h4>"
    );

    text = text.replace(
      /^##[ \t]+(.+)$/gm,
      "<h3>$1</h3>"
    );

    text = text.replace(
      /^#[ \t]+(.+)$/gm,
      "<h2>$1</h2>"
    );

    /*
     * Bold.
     */
    text = text.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    text = text.replace(
      /__(.+?)__/g,
      "<strong>$1</strong>"
    );

    /*
     * Italic.
     */
    text = text.replace(
      /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
      "$1<em>$2</em>"
    );

    text = text.replace(
      /(^|[^_])_([^_\n]+)_(?!_)/g,
      "$1<em>$2</em>"
    );

    /*
     * Build unordered and ordered lists line-by-line.
     *
     * This avoids the previous greedy <li> matching bug
     * where separate lists could accidentally be merged.
     */
    const lines = text.split("\n");
    const output = [];

    let listType = null;

    function closeList() {
      if (!listType) {
        return;
      }

      output.push(
        listType === "ul"
          ? "</ul>"
          : "</ol>"
      );

      listType = null;
    }

    for (const line of lines) {
      const unordered = line.match(
        /^\s*[-*+]\s+(.+)$/
      );

      const ordered = line.match(
        /^\s*\d+\.\s+(.+)$/
      );

      if (unordered) {
        if (listType !== "ul") {
          closeList();
          output.push("<ul>");
          listType = "ul";
        }

        output.push(
          `<li>${unordered[1]}</li>`
        );

        continue;
      }

      if (ordered) {
        if (listType !== "ol") {
          closeList();
          output.push("<ol>");
          listType = "ol";
        }

        output.push(
          `<li>${ordered[1]}</li>`
        );

        continue;
      }

      closeList();
      output.push(line);
    }

    closeList();

    text = output.join("\n");

    /*
     * Paragraphs / line breaks.
     *
     * Do not wrap block elements inside <p>.
     */
    const blocks = text.split(
      /\n{2,}/
    );

    text = blocks
      .map(block => {
        const trimmed = block.trim();

        if (!trimmed) {
          return "";
        }

        if (
          /^<(h2|h3|h4|ul|ol|div|pre)/.test(
            trimmed
          ) ||
          /^@@CODEBLOCK_\d+@@$/.test(
            trimmed
          )
        ) {
          return trimmed;
        }

        return `<p>${trimmed.replace(
          /\n/g,
          "<br>"
        )}</p>`;
      })
      .filter(Boolean)
      .join("");

    /*
     * Restore fenced code blocks.
     */
    codeBlocks.forEach(
      (block, index) => {
        const languageLabel =
          block.language
            ? `<span class="code-lang">${escapeHTML(
                block.language
              )}</span>`
            : "";

        const codeHTML =
          escapeHTML(block.code);

        const codeMarkup = `
          <div class="code-block">
            <div class="code-block__top">
              ${languageLabel}
              <button
                type="button"
                class="code-copy"
                data-code="${encodeURIComponent(
                  block.code
                )}"
                aria-label="Copy code"
              >
                Copy
              </button>
            </div>
            <pre><code>${codeHTML}</code></pre>
          </div>
        `;

        text = text.replace(
          `@@CODEBLOCK_${index}@@`,
          codeMarkup
        );
      }
    );

    return text;
  }

  /* =========================================================
     RENDER CONVERSATION LIST
     ========================================================= */

  function renderConversationList(
    filter = ""
  ) {
    if (!conversationList) return;

    const query = String(filter || "")
      .trim()
      .toLowerCase();

    const filtered =
      conversations.filter(
        conversation =>
          conversation.title
            .toLowerCase()
            .includes(query)
      );

    conversationList.innerHTML = "";

    if (!filtered.length) {
      const empty =
        document.createElement("div");

      empty.className = "history-empty";

      empty.textContent = query
        ? "No matching conversations."
        : "No conversations yet.";

      conversationList.appendChild(empty);

      return;
    }

    filtered.forEach(
      conversation => {
        const row =
          document.createElement("div");

        row.className =
          "conversation-row" +
          (conversation.id ===
          activeConversationId
            ? " is-active"
            : "");

        row.dataset.id =
          conversation.id;

        const info =
          document.createElement("button");

        info.type = "button";
        info.className =
          "conversation-row__main";

        info.innerHTML = `
          <span class="conversation-row__title">
            ${escapeHTML(
              conversation.title
            )}
          </span>
          <span class="conversation-row__date">
            ${escapeHTML(
              formatDate(
                conversation.updatedAt
              )
            )}
          </span>
        `;

        info.addEventListener(
          "click",
          () => {
            selectConversation(
              conversation.id
            );
          }
        );

        const deleteBtn =
          document.createElement(
            "button"
          );

        deleteBtn.type = "button";

        deleteBtn.className =
          "conversation-row__delete";

        deleteBtn.setAttribute(
          "aria-label",
          `Delete ${conversation.title}`
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

        row.append(
          info,
          deleteBtn
        );

        conversationList.appendChild(
          row
        );
      }
    );
  }

  /* =========================================================
     RENDER MESSAGES
     ========================================================= */

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

      updateComposerState();
      return;
    }

    if (chatEmpty) {
      chatEmpty.hidden = true;
    }

    conversation.messages.forEach(
      (message, index) => {
        const element =
          createMessageElement(
            message,
            index
          );

        chatMessages.appendChild(
          element
        );
      }
    );

    scrollChatToBottom(false);
    updateComposerState();
  }

  function createMessageElement(
    message,
    index
  ) {
    const wrapper =
      document.createElement("article");

    wrapper.className =
      `msg msg--${message.role}`;

    wrapper.dataset.messageId =
      message.id;

    const avatar =
      document.createElement("div");

    avatar.className =
      "msg__avatar";

    avatar.textContent =
      message.role === "user"
        ? "You"
        : "O";

    const body =
      document.createElement("div");

    body.className =
      "msg__body";

    const meta =
      document.createElement("div");

    meta.className =
      "msg__meta";

    meta.innerHTML = `
      <span class="msg__role">
        ${
          message.role === "user"
            ? "You"
            : "OZLIND AI"
        }
      </span>
      <time class="msg__time">
        ${escapeHTML(
          formatTime(
            message.createdAt
          )
        )}
      </time>
    `;

    const content =
      document.createElement("div");

    content.className =
      "msg__content";

    if (message.role === "assistant") {
      content.innerHTML =
        renderMarkdownSafe(
          message.content || ""
        );
    } else {
      content.textContent =
        message.content;
    }

    if (
      Array.isArray(
        message.attachments
      ) &&
      message.attachments.length
    ) {
      const attachmentWrap =
        document.createElement(
          "div"
        );

      attachmentWrap.className =
        "msg__attachments";

      message.attachments.forEach(
        attachment => {
          if (
            !attachment ||
            !attachment.dataUrl
          ) {
            return;
          }

          const image =
            document.createElement(
              "img"
            );

          image.src =
            attachment.dataUrl;

          image.alt =
            attachment.name ||
            "Attached image";

          image.loading = "lazy";

          image.decoding = "async";

          attachmentWrap.appendChild(
            image
          );
        }
      );

      if (
        attachmentWrap.children
          .length
      ) {
        body.appendChild(
          attachmentWrap
        );
      }
    }

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "msg__actions";

    if (
      message.role ===
      "assistant"
    ) {
      actions.appendChild(
        createActionButton(
          "copy",
          "Copy",
          () =>
            copyText(
              message.content
            )
        )
      );

      actions.appendChild(
        createActionButton(
          "regenerate",
          "Regenerate",
          () =>
            regenerateMessage(
              index
            )
        )
      );

      actions.appendChild(
        createActionButton(
          "like",
          "Helpful",
          () =>
            setFeedback(
              message,
              "like"
            )
        )
      );

      actions.appendChild(
        createActionButton(
          "dislike",
          "Not helpful",
          () =>
            setFeedback(
              message,
              "dislike"
            )
        )
      );
    }

    actions.appendChild(
      createActionButton(
        "edit",
        "Edit",
        () =>
          editMessage(
            message,
            index
          )
      )
    );

    actions.appendChild(
      createActionButton(
        "delete",
        "Delete",
        () =>
          deleteMessage(
            message.id
          )
      )
    );

    body.append(
      meta,
      content,
      actions
    );

    wrapper.append(
      avatar,
      body
    );

    return wrapper;
  }

  function createActionButton(
    type,
    label,
    handler
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      `msg-action msg-action--${type}`;

    button.title = label;

    button.setAttribute(
      "aria-label",
      label
    );

    const icons = {
      copy: "⧉",
      regenerate: "↻",
      like: "♡",
      dislike: "♧",
      edit: "✎",
      delete: "⌫"
    };

    button.textContent =
      icons[type] || "•";

    button.addEventListener(
      "click",
      handler
    );

    return button;
  }

  function refreshSingleMessage(
    messageId
  ) {
    const conversation =
      getActiveConversation();

    if (!conversation) return;

    const index =
      conversation.messages.findIndex(
        message =>
          message.id === messageId
      );

    if (index === -1) return;

    const oldElement =
      chatMessages?.querySelector(
        `[data-message-id="${CSS.escape(
          messageId
        )}"]`
      );

    if (!oldElement) {
      renderMessages();
      return;
    }

    const newElement =
      createMessageElement(
        conversation.messages[index],
        index
      );

    oldElement.replaceWith(
      newElement
    );
  }

  /* =========================================================
     FEEDBACK
     ========================================================= */

  function setFeedback(
    message,
    feedback
  ) {
    if (!message) return;

    message.feedback =
      message.feedback === feedback
        ? null
        : feedback;

    saveConversations();

    refreshSingleMessage(
      message.id
    );
  }

  /* =========================================================
     MESSAGE EDIT / DELETE
     ========================================================= */

  function editMessage(
    message,
    index
  ) {
    if (!chatInput) return;

    if (
      !message ||
      message.role !== "user"
    ) {
      return;
    }

    chatInput.value =
      message.content;

    /*
     * Restore attachments to the composer
     * when editing a user message.
     */
    pendingAttachments =
      Array.isArray(
        message.attachments
      )
        ? message.attachments.slice(
            0,
            LIMITS.maxAttachments
          )
        : [];

    autoGrowTextarea();

    renderPendingAttachments();

    const conversation =
      getActiveConversation();

    if (!conversation) return;

    conversation.messages =
      conversation.messages.slice(
        0,
        index
      );

    conversation.updatedAt =
      now();

    saveConversations();
    renderConversationList();
    renderMessages();

    chatInput.focus();

    toast(
      "Message loaded for editing."
    );
  }

  function deleteMessage(
    messageId
  ) {
    const conversation =
      getActiveConversation();

    if (!conversation) return;

    const index =
      conversation.messages.findIndex(
        message =>
          message.id === messageId
      );

    if (index === -1) return;

    conversation.messages.splice(
      index,
      1
    );

    conversation.updatedAt =
      now();

    if (
      !conversation.messages.length
    ) {
      conversation.title =
        "New chat";
    }

    saveConversations();
    renderConversationList();
    renderMessages();
  }

  /* =========================================================
     COPY
     ========================================================= */

  async function copyText(text) {
    const value =
      String(text || "");

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          value
        );

        toast(
          "Copied to clipboard."
        );

        return;
      }
    } catch {
      // Fall back below.
    }

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = value;

    textarea.style.position =
      "fixed";

    textarea.style.left =
      "-9999px";

    textarea.style.top =
      "0";

    textarea.style.opacity =
      "0";

    document.body.appendChild(
      textarea
    );

    textarea.focus();
    textarea.select();

    try {
      const copied =
        document.execCommand(
          "copy"
        );

      if (!copied) {
        throw new Error(
          "Copy command failed."
        );
      }

      toast(
        "Copied to clipboard."
      );
    } catch {
      toast(
        "Copy failed.",
        "error"
      );
    } finally {
      textarea.remove();
    }
  }

  /* =========================================================
     CODE COPY
     ========================================================= */

  function handleCodeCopy(
    event
  ) {
    const button =
      event.target.closest(
        ".code-copy"
      );

    if (!button) return;

    const encoded =
      button.dataset.code || "";

    let code = "";

    try {
      code =
        decodeURIComponent(
          encoded
        );
    } catch {
      code = encoded;
    }

    copyText(code);
  }

  /* =========================================================
     ATTACHMENTS
     ========================================================= */

  function isSupportedImage(
    file
  ) {
    return (
      file &&
      typeof file.type ===
        "string" &&
      file.type.startsWith(
        "image/"
      )
    );
  }

  function validateAttachment(
    file
  ) {
    if (!isSupportedImage(file)) {
      return (
        "Only image files are supported."
      );
    }

    if (
      file.size >
      LIMITS.maxAttachmentSize
    ) {
      return (
        "Image must be smaller than 8 MB."
      );
    }

    return null;
  }

  function readImage(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () => {
          const image =
            new Image();

          image.onload = () => {
            resolve({
              file,
              image,
              dataUrl:
                reader.result
            });
          };

          image.onerror = () =>
            reject(
              new Error(
                "Invalid image."
              )
            );

          image.src =
            reader.result;
        };

        reader.onerror = () =>
          reject(
            new Error(
              "Unable to read image."
            )
          );

        reader.readAsDataURL(
          file
        );
      }
    );
  }

  async function compressImage(
    file
  ) {
    const loaded =
      await readImage(file);

    let {
      width,
      height
    } = loaded.image;

    const max =
      LIMITS.maxAttachmentDimension;

    if (
      width > max ||
      height > max
    ) {
      const scale =
        Math.min(
          max / width,
          max / height
        );

      width = Math.max(
        1,
        Math.round(
          width * scale
        )
      );

      height = Math.max(
        1,
        Math.round(
          height * scale
        )
      );
    }

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext(
        "2d",
        {
          alpha: false
        }
      );

    if (!context) {
      throw new Error(
        "Canvas is unavailable."
      );
    }

    context.imageSmoothingEnabled =
      true;

    context.imageSmoothingQuality =
      "high";

    context.drawImage(
      loaded.image,
      0,
      0,
      width,
      height
    );

    let dataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.82
      );

    /*
     * Extra safety:
     * if compression still creates a very large
     * data URL, lower JPEG quality.
     */
    if (
      dataUrl.length >
      5_000_000
    ) {
      dataUrl =
        canvas.toDataURL(
          "image/jpeg",
          0.68
        );
    }

    return {
      name:
        typeof file.name ===
        "string"
          ? file.name
          : "image.jpg",

      type: "image/jpeg",

      dataUrl,

      width,
      height
    };
  }

  async function handleFiles(
    files
  ) {
    const selected =
      Array.from(files || []);

    if (!selected.length) {
      return;
    }

    if (
      pendingAttachments.length >=
      LIMITS.maxAttachments
    ) {
      toast(
        `Maximum ${LIMITS.maxAttachments} images allowed.`,
        "error"
      );

      return;
    }

    const available =
      LIMITS.maxAttachments -
      pendingAttachments.length;

    const filesToProcess =
      selected.slice(
        0,
        available
      );

    for (
      const file of filesToProcess
    ) {
      const error =
        validateAttachment(
          file
        );

      if (error) {
        toast(
          error,
          "error"
        );

        continue;
      }

      try {
        const image =
          await compressImage(
            file
          );

        pendingAttachments.push(
          image
        );
      } catch (error) {
        console.error(
          error
        );

        toast(
          `Could not process ${file.name}.`,
          "error"
        );
      }
    }

    renderPendingAttachments();

    if (fileInput) {
      fileInput.value = "";
    }

    updateComposerState();
  }

  function renderPendingAttachments() {
    if (!chatAttachments) {
      return;
    }

    chatAttachments.innerHTML =
      "";

    pendingAttachments.forEach(
      (attachment, index) => {
        const chip =
          document.createElement(
            "div"
          );

        chip.className =
          "attachment-chip";

        const image =
          document.createElement(
            "img"
          );

        image.src =
          attachment.dataUrl;

        image.alt = "";

        image.loading =
          "lazy";

        const name =
          document.createElement(
            "span"
          );

        name.textContent =
          attachment.name ||
          "Attached image";

        const remove =
          document.createElement(
            "button"
          );

        remove.type =
          "button";

        remove.className =
          "attachment-chip__remove";

        remove.dataset.index =
          String(index);

        remove.setAttribute(
          "aria-label",
          "Remove attachment"
        );

        remove.textContent =
          "×";

        chip.append(
          image,
          name,
          remove
        );

        chatAttachments.appendChild(
          chip
        );
      }
    );

    chatAttachments.hidden =
      pendingAttachments.length ===
      0;
  }

  function removeAttachment(
    index
  ) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >=
        pendingAttachments.length
    ) {
      return;
    }

    pendingAttachments.splice(
      index,
      1
    );

    renderPendingAttachments();
    updateComposerState();
  }

  /* =========================================================
     VOICE INPUT
     ========================================================= */

  function setupVoiceInput() {
    if (!voiceBtn) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      voiceBtn.hidden = true;
      return;
    }

    recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults =
      true;

    recognition.lang =
      document.documentElement
        .lang ||
      "en-US";

    recognition.onstart = () => {
      isListening = true;

      voiceBtn.classList.add(
        "is-active"
      );

      voiceBtn.setAttribute(
        "aria-label",
        "Stop voice input"
      );

      voiceBtn.setAttribute(
        "aria-pressed",
        "true"
      );
    };

    recognition.onresult = event => {
      let finalText = "";

      for (
        let i =
          event.resultIndex;
        i <
        event.results.length;
        i++
      ) {
        finalText +=
          event.results[i][0]
            .transcript;
      }

      if (chatInput) {
        chatInput.value =
          finalText.trim();

        autoGrowTextarea();
        updateComposerState();
      }
    };

    recognition.onerror =
      event => {
        console.error(
          "Speech recognition error:",
          event.error
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
      isListening = false;

      voiceBtn.classList.remove(
        "is-active"
      );

      voiceBtn.setAttribute(
        "aria-label",
        "Voice input"
      );

      voiceBtn.setAttribute(
        "aria-pressed",
        "false"
      );
    };
  }

  function toggleVoiceInput() {
    if (!recognition) {
      toast(
        "Voice input is not supported here.",
        "error"
      );

      return;
    }

    try {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } catch (error) {
      console.error(
        "Voice input toggle failed:",
        error
      );
    }
  }

  /* =========================================================
     TEXTAREA
     ========================================================= */

  function autoGrowTextarea() {
    if (!chatInput) return;

    chatInput.style.height =
      "auto";

    const maxHeight = 220;

    chatInput.style.height =
      `${Math.min(
        chatInput.scrollHeight,
        maxHeight
      )}px`;
  }

  /* =========================================================
     COMPOSER STATE
     ========================================================= */

  function updateComposerState() {
    if (!sendBtn) return;

    const hasText =
      Boolean(
        chatInput?.value.trim()
      );

    const hasAttachments =
      pendingAttachments.length >
      0;

    sendBtn.disabled =
      isGenerating ||
      (!hasText &&
        !hasAttachments);

    if (stopBtn) {
      stopBtn.hidden =
        !isGenerating;
    }

    if (chatInput) {
      chatInput.disabled =
        isGenerating;
    }

    if (attachBtn) {
      attachBtn.disabled =
        isGenerating;
    }

    if (voiceBtn) {
      voiceBtn.disabled =
        isGenerating;
    }
  }

  /* =========================================================
     SCROLL
     ========================================================= */

  function scrollChatToBottom(
    smooth = true
  ) {
    if (!chatMessages) return;

    try {
      chatMessages.scrollTo({
        top:
          chatMessages.scrollHeight,
        behavior:
          smooth
            ? "smooth"
            : "auto"
      });
    } catch {
      chatMessages.scrollTop =
        chatMessages.scrollHeight;
    }
  }

  /* =========================================================
     REQUEST PAYLOAD
     ========================================================= */

  function buildApiMessages(
    conversation
  ) {
    if (!conversation) {
      return [];
    }

    return conversation.messages
      .slice(-20)
      .map(message => {
        if (
          message.role === "user" &&
          message.attachments?.length
        ) {
          const content = [
            {
              type: "text",
              text:
                message.content ||
                "Please analyze the attached image."
            }
          ];

          message.attachments
            .slice(
              0,
              LIMITS.maxAttachments
            )
            .forEach(
              attachment => {
                if (
                  !attachment?.dataUrl
                ) {
                  return;
                }

                content.push({
                  type:
                    "image_url",

                  image_url: {
                    url:
                      attachment.dataUrl
                  }
                });
              }
            );

          return {
            role: "user",
            content
          };
        }

        return {
          role: message.role,
          content:
            message.content
        };
      });
  }

  function calculatePayloadSize(
    messages
  ) {
    try {
      return JSON.stringify(
        messages
      ).length;
    } catch {
      return Infinity;
    }
  }

  /* =========================================================
     STREAM PARSER
     ========================================================= */

  async function consumeStreamingResponse(
    response,
    assistantMessage,
    assistantElement
  ) {
    if (!response.body) {
      await consumeJSONResponse(
        response,
        assistantMessage,
        assistantElement
      );

      return;
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder(
        "utf-8"
      );

    let buffer = "";

    try {
      while (true) {
        const {
          done,
          value
        } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true
          }
        );

        /*
         * SSE messages are separated by a blank line.
         * Processing complete events is more reliable than
         * processing individual network chunks.
         */
        const events =
          buffer.split(
            /\r?\n\r?\n/
          );

        buffer =
          events.pop() || "";

        for (
          const event of events
        ) {
          processSSEEvent(
            event,
            assistantMessage,
            assistantElement
          );
        }
      }

      /*
       * Flush remaining decoder bytes.
       */
      buffer += decoder.decode();

      if (buffer.trim()) {
        processSSEEvent(
          buffer,
          assistantMessage,
          assistantElement
        );
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore.
      }
    }
  }

  function processSSEEvent(
    event,
    assistantMessage,
    assistantElement
  ) {
    const lines =
      String(event || "")
        .split(/\r?\n/);

    const dataLines = [];

    for (
      const line of lines
    ) {
      if (
        line.startsWith(
          "data:"
        )
      ) {
        dataLines.push(
          line
            .slice(5)
            .trimStart()
        );
      }
    }

    if (!dataLines.length) {
      return;
    }

    const payload =
      dataLines.join("\n").trim();

    if (
      !payload ||
      payload === "[DONE]"
    ) {
      return;
    }

    let parsed;

    try {
      parsed =
        JSON.parse(payload);
    } catch {
      /*
       * Some providers may send a raw text payload.
       * Do not inject arbitrary malformed SSE JSON.
       */
      return;
    }

    const delta =
      parsed?.choices?.[0]?.delta
        ?.content ??
      parsed?.choices?.[0]?.message
        ?.content ??
      parsed?.delta ??
      parsed?.content ??
      "";

    if (!delta) {
      return;
    }

    assistantMessage.content +=
      String(delta);

    updateAssistantElement(
      assistantMessage,
      assistantElement
    );

    scrollChatToBottom(true);
  }

  async function consumeJSONResponse(
    response,
    assistantMessage,
    assistantElement
  ) {
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed (${response.status})`
      );
    }

    const content =
      data?.message ||
      data?.content ||
      data?.response ||
      data?.choices?.[0]?.message
        ?.content ||
      "";

    assistantMessage.content =
      typeof content === "string"
        ? content
        : JSON.stringify(
            content
          );

    updateAssistantElement(
      assistantMessage,
      assistantElement
    );
  }

  /* =========================================================
     ASSISTANT ELEMENT
     ========================================================= */

  function createAssistantPlaceholder(
    message
  ) {
    const element =
      document.createElement(
        "article"
      );

    element.className =
      "msg msg--assistant";

    element.dataset.messageId =
      message.id;

    element.innerHTML = `
      <div class="msg__avatar">O</div>

      <div class="msg__body">
        <div class="msg__meta">
          <span class="msg__role">
            OZLIND AI
          </span>

          <time class="msg__time">
            Now
          </time>
        </div>

        <div class="msg__content msg__content--streaming">
          <span class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </div>

        <div class="msg__actions"></div>
      </div>
    `;

    if (chatMessages) {
      chatMessages.appendChild(
        element
      );
    }

    return element;
  }

  function updateAssistantElement(
    message,
    element
  ) {
    if (!element) return;

    const content =
      $(".msg__content", element);

    if (!content) return;

    if (!message.content) {
      content.classList.add(
        "msg__content--streaming"
      );

      content.innerHTML = `
        <span class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </span>
      `;

      return;
    }

    content.classList.remove(
      "msg__content--streaming"
    );

    content.innerHTML =
      renderMarkdownSafe(
        message.content
      );
  }

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  async function sendMessage() {
    if (isGenerating) {
      return;
    }

    const text =
      chatInput?.value.trim() ||
      "";

    const attachments =
      pendingAttachments.slice();

    if (
      !text &&
      !attachments.length
    ) {
      return;
    }

    const conversation =
      ensureConversation();

    /*
     * Validate the current history before adding
     * the new message.
     */
    const currentPayload =
      buildApiMessages(
        conversation
      );

    if (
      calculatePayloadSize(
        currentPayload
      ) >
      LIMITS.maxTotalChars
    ) {
      toast(
        "This conversation is too large. Start a new chat.",
        "error"
      );

      return;
    }

    const userMessage = {
      id: createId("msg"),

      role: "user",

      content: text.slice(
        0,
        LIMITS.maxMessageChars
      ),

      createdAt: now(),

      attachments:
        attachments.slice(
          0,
          LIMITS.maxAttachments
        ),

      feedback: null
    };

    conversation.messages.push(
      userMessage
    );

    if (
      conversation.title ===
      "New chat"
    ) {
      conversation.title =
        generateConversationTitle(
          text ||
            attachments[0]
              ?.name ||
            "Image chat"
        );
    }

    conversation.updatedAt =
      now();

    chatInput.value = "";

    pendingAttachments = [];

    autoGrowTextarea();

    renderPendingAttachments();

    saveConversations();

    renderConversationList();

    renderMessages();

    await requestAssistantReply(
      conversation
    );
  }

  /* =========================================================
     REQUEST AI
     ========================================================= */

  async function requestAssistantReply(
    conversation
  ) {
    if (
      isGenerating ||
      !conversation
    ) {
      return;
    }

    const assistantMessage = {
      id: createId("msg"),
      role: "assistant",
      content: "",
      createdAt: now(),
      attachments: [],
      feedback: null
    };

    conversation.messages.push(
      assistantMessage
    );

    isGenerating = true;

    abortController =
      new AbortController();

    saveConversations();

    const assistantElement =
      createAssistantPlaceholder(
        assistantMessage
      );

    updateComposerState();

    scrollChatToBottom(true);

    const apiMessages =
      buildApiMessages(
        conversation
      );

    const payloadSize =
      calculatePayloadSize(
        apiMessages
      );

    if (
      payloadSize >
      LIMITS.maxTotalChars
    ) {
      conversation.messages.pop();

      isGenerating = false;

      abortController = null;

      saveConversations();

      renderMessages();

      toast(
        "Message data is too large. Please start a new chat or use a smaller image.",
        "error"
      );

      return;
    }

    try {
      const controller =
        abortController;

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "text/event-stream, application/json"
            },

            signal:
              controller.signal,

            body: JSON.stringify({
              messages:
                apiMessages,

              model:
                modelSelect?.value ||
                undefined,

              research:
                Boolean(
                  researchToggle?.getAttribute(
                    "aria-pressed"
                  ) === "true"
                ),

              responseLength:
                chatSettings.responseLength,

              responseStyle:
                chatSettings.responseStyle,

              customInstructions:
                getCustomInstructions(),

              memory:
                getMemoryEnabled()
            })
          }
        );

      if (!response.ok) {
        let errorMessage =
          `Request failed (${response.status})`;

        try {
          const errorData =
            await response.json();

          errorMessage =
            errorData?.error ||
            errorData?.message ||
            errorMessage;
        } catch {
          // Ignore invalid JSON.
        }

        throw new Error(
          errorMessage
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      /*
       * The backend normally streams SSE.
       * If a response body exists, consume it as a stream.
       * Otherwise use JSON.
       */
      if (
        contentType.includes(
          "text/event-stream"
        ) ||
        response.body
      ) {
        await consumeStreamingResponse(
          response,
          assistantMessage,
          assistantElement
        );
      } else {
        await consumeJSONResponse(
          response,
          assistantMessage,
          assistantElement
        );
      }

      if (
        !assistantMessage.content.trim()
      ) {
        throw new Error(
          "The AI returned an empty response."
        );
      }

      conversation.updatedAt =
        now();

      saveConversations();

      renderConversationList();

      refreshSingleMessage(
        assistantMessage.id
      );

      scrollChatToBottom(true);
    } catch (error) {
      /*
       * Abort is an intentional user action.
       */
      if (
        error?.name ===
        "AbortError"
      ) {
        if (
          !assistantMessage.content.trim()
        ) {
          conversation.messages =
            conversation.messages.filter(
              message =>
                message.id !==
                assistantMessage.id
            );
        } else {
          /*
           * Preserve partial output if the
           * user stopped after tokens arrived.
           */
          assistantMessage.content =
            assistantMessage.content.trim();
        }

        conversation.updatedAt =
          now();

        saveConversations();

        renderMessages();

        return;
      }

      console.error(
        "OZLIND chat error:",
        error
      );

      /*
       * Preserve any partial response.
       * If nothing was received, show a useful
       * fallback message.
       */
      if (
        assistantMessage.content.trim()
      ) {
        assistantMessage.content +=
          "\n\n_[Response interrupted. Please try again if needed.]_";
      } else {
        assistantMessage.content =
          "Sorry, I couldn't complete that request. Please try again.";
      }

      conversation.updatedAt =
        now();

      saveConversations();

      updateAssistantElement(
        assistantMessage,
        assistantElement
      );

      toast(
        error?.message ||
          "Unable to connect to OZLIND AI.",
        "error"
      );
    } finally {
      isGenerating = false;

      abortController = null;

      updateComposerState();

      saveConversations();
    }
  }

  /* =========================================================
     STOP GENERATION
     ========================================================= */

  function stopGeneration() {
    if (!abortController) {
      return;
    }

    /*
     * Do not manually set isGenerating to false here.
     * The request's finally block owns the lifecycle.
     */
    abortController.abort();
  }

  /* =========================================================
     REGENERATE
     ========================================================= */

  async function regenerateMessage(
    index
  ) {
    if (isGenerating) {
      toast(
        "Please wait for the current response."
      );

      return;
    }

    const conversation =
      getActiveConversation();

    if (!conversation) return;

    const message =
      conversation.messages[index];

    if (
      !message ||
      message.role !==
        "assistant"
    ) {
      return;
    }

    /*
     * Remove the selected assistant response
     * and everything after it.
     *
     * This preserves the user message immediately
     * before the response.
     */
    conversation.messages =
      conversation.messages.slice(
        0,
        index
      );

    conversation.updatedAt =
      now();

    saveConversations();

    renderMessages();

    await requestAssistantReply(
      conversation
    );
  }

  /* =========================================================
     HISTORY PANEL
     ========================================================= */

  function openHistory() {
    if (!chatHistoryPanel) {
      return;
    }

    chatHistoryPanel.hidden = false;

    renderConversationList(
      conversationSearch?.value ||
        ""
    );

    requestAnimationFrame(() => {
      chatHistoryPanel.classList.add(
        "is-open"
      );
    });
  }

  function closeHistory() {
    if (!chatHistoryPanel) {
      return;
    }

    chatHistoryPanel.classList.remove(
      "is-open"
    );

    window.setTimeout(() => {
      if (
        !chatHistoryPanel.classList.contains(
          "is-open"
        )
      ) {
        chatHistoryPanel.hidden =
          true;
      }
    }, 200);
  }

  /* =========================================================
     CHAT SETTINGS MODAL
     ========================================================= */

  function openChatSettings() {
    openModal(
      "Chat settings",
      `
        <div class="settings-form">
          <label class="field">
            <span>Response length</span>

            <select id="modalResponseLength">
              <option value="short">
                Short
              </option>

              <option value="balanced">
                Balanced
              </option>

              <option value="detailed">
                Detailed
              </option>
            </select>
          </label>

          <label class="field">
            <span>Response style</span>

            <select id="modalResponseStyle">
              <option value="professional">
                Professional
              </option>

              <option value="friendly">
                Friendly
              </option>

              <option value="concise">
                Concise
              </option>

              <option value="technical">
                Technical
              </option>
            </select>
          </label>

          <label class="field">
            <span>Custom instructions</span>

            <textarea
              id="modalCustomInstructions"
              rows="5"
              maxlength="5000"
              placeholder="Tell OZLIND how you want responses written..."
            ></textarea>
          </label>

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn--primary"
              id="saveChatSettings"
            >
              Save settings
            </button>
          </div>
        </div>
      `
    );

    const lengthSelect =
      $("#modalResponseLength");

    const styleSelect =
      $("#modalResponseStyle");

    const instructions =
      $("#modalCustomInstructions");

    if (lengthSelect) {
      lengthSelect.value =
        chatSettings.responseLength;
    }

    if (styleSelect) {
      styleSelect.value =
        chatSettings.responseStyle;
    }

    if (instructions) {
      instructions.value =
        getCustomInstructions();
    }

    const saveBtn =
      $("#saveChatSettings");

    saveBtn?.addEventListener(
      "click",
      () => {
        const length =
          lengthSelect?.value ||
          "balanced";

        const style =
          styleSelect?.value ||
          "professional";

        chatSettings.responseLength =
          [
            "short",
            "balanced",
            "detailed"
          ].includes(length)
            ? length
            : "balanced";

        chatSettings.responseStyle =
          [
            "professional",
            "friendly",
            "concise",
            "technical"
          ].includes(style)
            ? style
            : "professional";

        saveSettings();

        storageSet(
          STORAGE.customInstructions,
          (
            instructions?.value ||
            ""
          )
            .trim()
            .slice(
              0,
              LIMITS.maxCustomInstructions
            )
        );

        closeModal();

        toast(
          "Chat settings saved."
        );
      }
    );
  }

  /* =========================================================
     MODAL
     ========================================================= */

  function openModal(
    title,
    html
  ) {
    if (
      !modalOverlay ||
      !modalBody
    ) {
      return;
    }

    if (modalTitle) {
      modalTitle.textContent =
        title;
    }

    modalBody.innerHTML = html;

    modalOverlay.hidden = false;

    requestAnimationFrame(() => {
      modalOverlay.classList.add(
        "is-open"
      );
    });

    document.body.classList.add(
      "modal-open"
    );

    /*
     * Focus the first interactive field
     * for accessibility.
     */
    requestAnimationFrame(() => {
      const firstFocusable =
        modal?.querySelector(
          "button, input, select, textarea"
        );

      firstFocusable?.focus();
    });
  }

  function closeModal() {
    if (!modalOverlay) {
      return;
    }

    modalOverlay.classList.remove(
      "is-open"
    );

    window.setTimeout(() => {
      modalOverlay.hidden =
        true;
    }, 180);

    document.body.classList.remove(
      "modal-open"
    );
  }

  /* =========================================================
     EXPORT / IMPORT
     ========================================================= */

  function exportHistory() {
    const data = {
      version: 1,
      exportedAt: now(),
      conversations
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
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

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `ozlind-chat-history-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(
        url
      );
    }, 1000);

    toast(
      "Chat history exported."
    );
  }

  function validateImportedHistory(
    parsed
  ) {
    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
      return null;
    }

    if (
      !Array.isArray(
        parsed.conversations
      )
    ) {
      return null;
    }

    const normalized =
      parsed.conversations
        .map(
          normalizeConversation
        )
        .filter(Boolean)
        .slice(
          0,
          LIMITS.maxConversations
        );

    if (!normalized.length) {
      return null;
    }

    return normalized;
  }

  function importHistory(
    file
  ) {
    if (!file) return;

    if (
      file.type &&
      file.type !==
        "application/json"
    ) {
      toast(
        "Please select a JSON history file.",
        "error"
      );

      return;
    }

    if (
      file.size >
      LIMITS.maxHistoryFileSize
    ) {
      toast(
        "History file is too large.",
        "error"
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      const parsed =
        safeJSONParse(
          String(
            reader.result || ""
          ),
          null
        );

      const imported =
        validateImportedHistory(
          parsed
        );

      if (!imported) {
        toast(
          "Invalid OZLIND history file.",
          "error"
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Import this history?\n\nExisting local history will be replaced."
        );

      if (!confirmed) {
        return;
      }

      conversations =
        imported;

      activeConversationId =
        conversations[0]?.id ||
        null;

      saveConversations();

      renderConversationList();

      renderMessages();

      toast(
        "Chat history imported."
      );
    };

    reader.onerror = () => {
      toast(
        "Could not read the history file.",
        "error"
      );
    };

    reader.readAsText(
      file
    );
  }

  /* =========================================================
     CLEAR LOCAL DATA
     ========================================================= */

  function clearAllChatData() {
    const confirmed =
      window.confirm(
        "Clear all OZLIND local chat data?\n\nThis removes conversations, chat settings and custom instructions from this browser."
      );

    if (!confirmed) {
      return;
    }

    storageRemove(
      STORAGE.conversations
    );

    storageRemove(
      STORAGE.settings
    );

    storageRemove(
      STORAGE.customInstructions
    );

    storageRemove(
      STORAGE.memory
    );

    conversations = [];

    activeConversationId =
      null;

    pendingAttachments = [];

    chatSettings =
      loadSettings();

    renderPendingAttachments();

    renderConversationList();

    renderMessages();

    updateComposerState();

    toast(
      "Local chat data cleared."
    );
  }

  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function setupEvents() {
    newChatBtn?.addEventListener(
      "click",
      () => {
        if (isGenerating) {
          toast(
            "Please stop the current response first."
          );

          return;
        }

        createConversation();
      }
    );

    chatForm?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        sendMessage();
      }
    );

    chatInput?.addEventListener(
      "input",
      () => {
        autoGrowTextarea();
        updateComposerState();
      }
    );

    chatInput?.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
            "Enter" &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault();

          sendMessage();
        }
      }
    );

    sendBtn?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        sendMessage();
      }
    );

    stopBtn?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        stopGeneration();
      }
    );

    attachBtn?.addEventListener(
      "click",
      () => {
        if (isGenerating) {
          return;
        }

        fileInput?.click();
      }
    );

    fileInput?.addEventListener(
      "change",
      event => {
        if (isGenerating) {
          return;
        }

        handleFiles(
          event.target.files
        );
      }
    );

    voiceBtn?.addEventListener(
      "click",
      toggleVoiceInput
    );

    chatAttachments?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            ".attachment-chip__remove"
          );

        if (!button) {
          return;
        }

        const index =
          Number(
            button.dataset.index
          );

        if (
          Number.isInteger(
            index
          )
        ) {
          removeAttachment(
            index
          );
        }
      }
    );

    chatMessages?.addEventListener(
      "click",
      handleCodeCopy
    );

    chatHistoryPanel?.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          chatHistoryPanel
        ) {
          closeHistory();
        }
      }
    );

    closeHistoryPanel?.addEventListener(
      "click",
      closeHistory
    );

    conversationSearch?.addEventListener(
      "input",
      debounce(event => {
        renderConversationList(
          event.target.value
        );
      }, 150)
    );

    chatSettingsBtn?.addEventListener(
      "click",
      openChatSettings
    );

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
          event.key ===
          "Escape"
        ) {
          closeModal();
          closeHistory();
        }
      }
    );

    /* =======================================================
       DRAG & DROP ATTACHMENTS
       ======================================================= */

    chatForm?.addEventListener(
      "dragover",
      event => {
        if (isGenerating) {
          return;
        }

        event.preventDefault();

        chatForm.classList.add(
          "is-dragging"
        );
      }
    );

    chatForm?.addEventListener(
      "dragleave",
      event => {
        if (
          !chatForm.contains(
            event.relatedTarget
          )
        ) {
          chatForm.classList.remove(
            "is-dragging"
          );
        }
      }
    );

    chatForm?.addEventListener(
      "drop",
      event => {
        event.preventDefault();

        chatForm.classList.remove(
          "is-dragging"
        );

        if (isGenerating) {
          return;
        }

        handleFiles(
          event.dataTransfer
            ?.files
        );
      }
    );

    /* =======================================================
       MOBILE SIDEBAR
       ======================================================= */

    mobileNavBtn?.addEventListener(
      "click",
      () => {
        document.body.classList.toggle(
          "sidebar-open"
        );
      }
    );

    sidebarOverlay?.addEventListener(
      "click",
      () => {
        document.body.classList.remove(
          "sidebar-open"
        );
      }
    );

    /* =======================================================
       GLOBAL NAVIGATION
       ======================================================= */

    $$(
      "[data-view]"
    ).forEach(item => {
      item.addEventListener(
        "click",
        () => {
          document.body.classList.remove(
            "sidebar-open"
          );
        }
      );
    });

    /* =======================================================
       THEME BUTTONS
       ======================================================= */

    $("#themeToggleMobile")
      ?.addEventListener(
        "click",
        toggleTheme
      );

    $("#themeToggleDesktop")
      ?.addEventListener(
        "click",
        toggleTheme
      );

    /* =======================================================
       RESEARCH
       ======================================================= */

    researchToggle?.addEventListener(
      "click",
      () => {
        const active =
          researchToggle.getAttribute(
            "aria-pressed"
          ) === "true";

        researchToggle.setAttribute(
          "aria-pressed",
          String(!active)
        );
      }
    );
  }

  /* =========================================================
     THEME
     ========================================================= */

  function getTheme() {
    const theme =
      storageGet(
        STORAGE.theme,
        "system"
      );

    return [
      "system",
      "light",
      "dark"
    ].includes(theme)
      ? theme
      : "system";
  }

  function applyTheme(
    theme
  ) {
    const root =
      document.documentElement;

    const validTheme = [
      "system",
      "light",
      "dark"
    ].includes(theme)
      ? theme
      : "system";

    if (
      validTheme === "dark" ||
      validTheme === "light"
    ) {
      root.dataset.theme =
        validTheme;
    } else {
      delete root.dataset.theme;
    }

    storageSet(
      STORAGE.theme,
      validTheme
    );

    updateThemeButtons(
      validTheme
    );
  }

  function updateThemeButtons(
    theme
  ) {
    const label =
      theme === "dark"
        ? "Light mode"
        : theme === "light"
        ? "System theme"
        : "Dark mode";

    $("#themeToggleMobile")
      ?.setAttribute(
        "aria-label",
        label
      );

    $("#themeToggleDesktop")
      ?.setAttribute(
        "aria-label",
        label
      );
  }

  function toggleTheme() {
    const current =
      getTheme();

    const next =
      current === "system"
        ? "dark"
        : current === "dark"
        ? "light"
        : "system";

    applyTheme(next);

    /*
     * Also synchronize settings-page theme buttons.
     */
    const themeGroup =
      $("#settingsThemeGroup");

    if (themeGroup) {
      $$(
        "button",
        themeGroup
      ).forEach(button => {
        button.classList.toggle(
          "is-active",
          button.dataset.theme ===
            next
        );
      });
    }
  }

  /* =========================================================
     SETTINGS PAGE HELPERS
     ========================================================= */

  function setupSettingsControls() {
    const themeGroup =
      $("#settingsThemeGroup");

    if (themeGroup) {
      const currentTheme =
        getTheme();

      $$(
        "button",
        themeGroup
      ).forEach(button => {
        const value =
          button.dataset.theme;

        button.classList.toggle(
          "is-active",
          value ===
            currentTheme
        );

        button.addEventListener(
          "click",
          () => {
            if (
              ![
                "system",
                "light",
                "dark"
              ].includes(value)
            ) {
              return;
            }

            applyTheme(
              value
            );

            $$(
              "button",
              themeGroup
            ).forEach(
              item => {
                item.classList.toggle(
                  "is-active",
                  item.dataset
                    .theme ===
                    value
                );
              }
            );
          }
        );
      });
    }

    const customInstructionsBtn =
      $("#customInstructionsBtn");

    customInstructionsBtn?.addEventListener(
      "click",
      openCustomInstructionsModal
    );

    const memoryToggle =
      $("#memoryToggle");

    if (memoryToggle) {
      memoryToggle.checked =
        getMemoryEnabled();

      memoryToggle.addEventListener(
        "change",
        () => {
          storageSet(
            STORAGE.memory,
            String(
              memoryToggle.checked
            )
          );

          toast(
            memoryToggle.checked
              ? "Memory enabled."
              : "Memory disabled."
          );
        }
      );
    }

    $("#exportHistoryBtn")
      ?.addEventListener(
        "click",
        exportHistory
      );

    const importHistoryBtn =
      $("#importHistoryBtn");

    const importHistoryInput =
      $("#importHistoryInput");

    importHistoryBtn?.addEventListener(
      "click",
      () => {
        importHistoryInput?.click();
      }
    );

    importHistoryInput?.addEventListener(
      "change",
      event => {
        importHistory(
          event.target.files?.[0]
        );

        event.target.value =
          "";
      }
    );

    $("#clearDataBtn")
      ?.addEventListener(
        "click",
        clearAllChatData
      );
  }

  function openCustomInstructionsModal() {
    openModal(
      "Custom instructions",
      `
        <div class="settings-form">
          <label class="field">
            <span>
              Instructions for OZLIND AI
            </span>

            <textarea
              id="customInstructionEditor"
              rows="8"
              maxlength="5000"
              placeholder="Example: Keep answers concise and explain technical terms simply."
            ></textarea>
          </label>

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn--primary"
              id="saveCustomInstructions"
            >
              Save instructions
            </button>
          </div>
        </div>
      `
    );

    const textarea =
      $("#customInstructionEditor");

    if (textarea) {
      textarea.value =
        getCustomInstructions();
    }

    $("#saveCustomInstructions")
      ?.addEventListener(
        "click",
        () => {
          storageSet(
            STORAGE.customInstructions,
            (
              textarea?.value ||
              ""
            )
              .trim()
              .slice(
                0,
                LIMITS.maxCustomInstructions
              )
          );

          closeModal();

          toast(
            "Custom instructions saved."
          );
        }
      );
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function init() {
    applyTheme(
      getTheme()
    );

    setupEvents();

    setupVoiceInput();

    setupSettingsControls();

    renderPendingAttachments();

    if (
      conversations.length
    ) {
      activeConversationId =
        conversations[0].id;
    }

    renderConversationList();

    renderMessages();

    autoGrowTextarea();

    updateComposerState();

    /*
     * Keep system theme responsive.
     */
    const mediaQuery =
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      );

    if (
      mediaQuery &&
      typeof mediaQuery.addEventListener ===
        "function"
    ) {
      mediaQuery.addEventListener(
        "change",
        () => {
          if (
            getTheme() ===
            "system"
          ) {
            applyTheme(
              "system"
            );
          }
        }
      );
    } else if (
      mediaQuery &&
      typeof mediaQuery.addListener ===
        "function"
    ) {
      /*
       * Older browser fallback.
       */
      mediaQuery.addListener(
        () => {
          if (
            getTheme() ===
            "system"
          ) {
            applyTheme(
              "system"
            );
          }
        }
      );
    }

    /*
     * Clean up any accidental drag state when
     * the pointer leaves the document.
     */
    document.addEventListener(
      "drop",
      () => {
        chatForm?.classList.remove(
          "is-dragging"
        );
      }
    );

    document.addEventListener(
      "dragend",
      () => {
        chatForm?.classList.remove(
          "is-dragging"
        );
      }
    );
  }

  /* =========================================================
     START
     ========================================================= */

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
