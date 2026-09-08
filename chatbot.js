/* =========================================================
   OZLIND — AI CHATBOT FRONTEND
   Full synchronized replacement
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   STORAGE
--------------------------------------------------------- */

const STORAGE = {
  conversations: "ozlind_conversations",
  currentConversation: "ozlind_current_conversation",
  theme: "ozlind_theme",
  memory: "ozlind_memory",
  responseStyle: "ozlind_response_style",
  responseLength: "ozlind_response_length",
  customInstructions: "ozlind_custom_instructions",
  favorites: "ozlind_favorites"
};

/* ---------------------------------------------------------
   APP STATE
--------------------------------------------------------- */

const state = {
  conversations: loadJSON(STORAGE.conversations, []),
  currentConversationId:
    localStorage.getItem(STORAGE.currentConversation) || null,

  attachments: [],
  generating: false,
  abortController: null,

  theme: localStorage.getItem(STORAGE.theme) || "system",
  memory:
    localStorage.getItem(STORAGE.memory) !== "false",

  responseStyle:
    localStorage.getItem(STORAGE.responseStyle) || "balanced",

  responseLength:
    localStorage.getItem(STORAGE.responseLength) || "auto",

  customInstructions:
    localStorage.getItem(STORAGE.customInstructions) || "",

  favorites: loadJSON(STORAGE.favorites, []),

  recognition: null,
  listening: false,

  research: false,
  editingMessageId: null,

  searchQuery: ""
};

/* ---------------------------------------------------------
   ELEMENTS
--------------------------------------------------------- */

const els = {
  body: document.body,

  sidebar: document.querySelector("#sidebar"),
  sidebarOverlay: document.querySelector("#sidebarOverlay"),
  closeSidebar: document.querySelector("#closeSidebar"),
  openSidebar: document.querySelector("#openSidebar"),

  newChatBtn: document.querySelector("#newChatBtn"),

  navItems: document.querySelectorAll(".nav-item"),
  featureCards: document.querySelectorAll(".feature-card"),
  pages: document.querySelectorAll("[data-page]"),

  globalSearch: document.querySelector("#globalSearch"),

  themeButton: document.querySelector('[data-action="theme"]'),
  clearButton: document.querySelector('[data-action="clear"]'),

  startCreating: document.querySelector("#startCreating"),
  heroChatBtn: document.querySelector("#heroChatBtn"),

  quickPrompt: document.querySelector("#quickPrompt"),
  quickSend: document.querySelector("#quickSend"),
  suggestions: document.querySelectorAll(".suggestion"),

  chatTitle: document.querySelector("#chatTitle"),
  exportChatBtn: document.querySelector("#exportChatBtn"),
  favoriteChatBtn: document.querySelector("#favoriteChatBtn"),

  chatMessages: document.querySelector("#chatMessages"),
  typingIndicator: document.querySelector("#typingIndicator"),

  attachmentPreview: document.querySelector("#attachmentPreview"),
  fileInput: document.querySelector("#fileInput"),

  messageInput: document.querySelector("#messageInput"),
  sendBtn: document.querySelector("#sendBtn"),

  voiceInputBtn: document.querySelector("#voiceInputBtn"),
  researchBtn: document.querySelector("#researchBtn"),

  responseLength: document.querySelector("#responseLength"),
  responseStyle: document.querySelector("#responseStyle"),
  memoryToggle: document.querySelector("#memoryToggle"),

  contextProgress: document.querySelector("#contextProgress"),
  contextText: document.querySelector("#contextText"),

  historySearch: document.querySelector(".history-search input"),
  historyList: document.querySelector("#historyList"),

  customInstructions: document.querySelector("#customInstructions"),

  toast: document.querySelector("#toast")
};

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", init);

function init() {
  applyTheme(state.theme);
  syncControls();
  setupNavigation();
  setupSidebar();
  setupHome();
  setupChat();
  setupAttachments();
  setupVoiceInput();
  setupHistory();
  setupSettings();
  setupKeyboardShortcuts();

  ensureConversation();

  renderCurrentConversation();
  updateContextIndicator();
}

/* ---------------------------------------------------------
   SAFE STORAGE HELPERS
--------------------------------------------------------- */

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    const parsed = JSON.parse(value);

    return parsed ?? fallback;
  } catch (error) {
    console.warn("OZLIND storage read error:", error);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("OZLIND storage write error:", error);
    showToast("Storage limit reached.");
  }
}

/* ---------------------------------------------------------
   ID HELPERS
--------------------------------------------------------- */

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

/* ---------------------------------------------------------
   CONVERSATIONS
--------------------------------------------------------- */

function ensureConversation() {
  if (!Array.isArray(state.conversations)) {
    state.conversations = [];
  }

  if (
    state.currentConversationId &&
    getConversation(state.currentConversationId)
  ) {
    return;
  }

  const conversation = createConversation();

  state.conversations.unshift(conversation);
  state.currentConversationId = conversation.id;

  persistConversations();
}

function createConversation() {
  return {
    id: createId("chat"),
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    messages: []
  };
}

function getConversation(id) {
  return state.conversations.find(
    (conversation) => conversation.id === id
  );
}

function getCurrentConversation() {
  return getConversation(state.currentConversationId);
}

function persistConversations() {
  saveJSON(STORAGE.conversations, state.conversations);

  if (state.currentConversationId) {
    localStorage.setItem(
      STORAGE.currentConversation,
      state.currentConversationId
    );
  }
}

function newConversation() {
  if (state.generating) {
    stopGeneration();
  }

  const conversation = createConversation();

  state.conversations.unshift(conversation);
  state.currentConversationId = conversation.id;
  state.attachments = [];
  state.editingMessageId = null;

  persistConversations();

  clearAttachments();
  renderCurrentConversation();
  updateContextIndicator();

  showPage("chat");
  closeSidebar();

  if (els.messageInput) {
    els.messageInput.focus();
  }
}

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */

function setupNavigation() {
  els.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;

      if (page) {
        showPage(page);
      }
    });
  });

  els.featureCards.forEach((card) => {
    card.addEventListener("click", () => {
      const page = card.dataset.page;

      if (page) {
        showPage(page);
      }
    });
  });
}

function showPage(pageName) {
  if (!pageName) return;

  els.pages.forEach((page) => {
    page.classList.toggle(
      "active",
      page.dataset.page === pageName
    );
  });

  els.navItems.forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  closeSidebar();

  if (pageName === "history") {
    renderHistory();
  }

  if (pageName === "favorites") {
    renderFavorites();
  }

  if (pageName === "settings") {
    syncSettingsUI();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ---------------------------------------------------------
   SIDEBAR
--------------------------------------------------------- */

function setupSidebar() {
  els.openSidebar?.addEventListener("click", openSidebar);
  els.closeSidebar?.addEventListener("click", closeSidebar);

  els.sidebarOverlay?.addEventListener("click", closeSidebar);

  els.newChatBtn?.addEventListener("click", newConversation);
}

function openSidebar() {
  els.sidebar?.classList.add("open");
  els.sidebarOverlay?.classList.add("active");
  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  els.sidebar?.classList.remove("open");
  els.sidebarOverlay?.classList.remove("active");
  document.body.classList.remove("sidebar-open");
}

/* ---------------------------------------------------------
   HOME
--------------------------------------------------------- */

function setupHome() {
  els.startCreating?.addEventListener("click", () => {
    showPage("chat");

    setTimeout(() => {
      els.messageInput?.focus();
    }, 100);
  });

  els.heroChatBtn?.addEventListener("click", () => {
    showPage("chat");

    setTimeout(() => {
      els.messageInput?.focus();
    }, 100);
  });

  els.quickSend?.addEventListener("click", () => {
    const prompt = els.quickPrompt?.value.trim();

    if (!prompt) {
      showToast("Enter a message first.");
      els.quickPrompt?.focus();
      return;
    }

    showPage("chat");

    if (els.messageInput) {
      els.messageInput.value = prompt;
      autoResizeTextarea();
      sendMessage();
    }
  });

  els.quickPrompt?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.quickSend?.click();
    }
  });

  els.suggestions.forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
      const prompt = suggestion.dataset.prompt || "";

      showPage("chat");

      if (els.messageInput) {
        els.messageInput.value = prompt;
        autoResizeTextarea();
        els.messageInput.focus();
      }
    });
  });
}

/* ---------------------------------------------------------
   CHAT SETUP
--------------------------------------------------------- */

function setupChat() {
  els.sendBtn?.addEventListener("click", () => {
    if (state.generating) {
      stopGeneration();
      return;
    }

    sendMessage();
  });

  els.messageInput?.addEventListener("input", () => {
    autoResizeTextarea();
    updateSendButton();
    updateContextIndicator();
  });

  els.messageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!state.generating) {
        sendMessage();
      }
    }
  });

  els.responseLength?.addEventListener("change", () => {
    state.responseLength = els.responseLength.value;

    localStorage.setItem(
      STORAGE.responseLength,
      state.responseLength
    );
  });

  els.responseStyle?.addEventListener("change", () => {
    state.responseStyle = els.responseStyle.value;

    localStorage.setItem(
      STORAGE.responseStyle,
      state.responseStyle
    );
  });

  els.memoryToggle?.addEventListener("change", () => {
    state.memory = Boolean(els.memoryToggle.checked);

    localStorage.setItem(
      STORAGE.memory,
      String(state.memory)
    );
  });

  els.researchBtn?.addEventListener("click", toggleResearch);

  els.favoriteChatBtn?.addEventListener(
    "click",
    toggleCurrentFavorite
  );

  els.exportChatBtn?.addEventListener(
    "click",
    exportCurrentConversation
  );
}

/* ---------------------------------------------------------
   CONTROL SYNC
--------------------------------------------------------- */

function syncControls() {
  if (els.responseLength) {
    els.responseLength.value = state.responseLength;
  }

  if (els.responseStyle) {
    els.responseStyle.value = state.responseStyle;
  }

  if (els.memoryToggle) {
    els.memoryToggle.checked = state.memory;
  }

  syncSettingsUI();
}

/* ---------------------------------------------------------
   SEND MESSAGE
--------------------------------------------------------- */

async function sendMessage() {
  if (state.generating) return;

  const conversation = getCurrentConversation();

  if (!conversation) {
    ensureConversation();
    return sendMessage();
  }

  const text = els.messageInput?.value.trim() || "";

  if (!text && state.attachments.length === 0) {
    showToast("Write a message or attach a file.");
    return;
  }

  const userMessage = {
    id: createId("msg"),
    role: "user",
    content: text,
    createdAt: Date.now(),
    attachments: state.attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: file.dataUrl
    }))
  };

  conversation.messages.push(userMessage);

  conversation.updatedAt = Date.now();

  if (
    conversation.title === "New conversation" ||
    !conversation.title
  ) {
    conversation.title = generateTitle(text);
  }

  els.messageInput.value = "";
  autoResizeTextarea();

  clearAttachments();

  persistConversations();
  renderCurrentConversation();

  await generateAssistantResponse();
}

/* ---------------------------------------------------------
   ASSISTANT RESPONSE
--------------------------------------------------------- */

async function generateAssistantResponse() {
  const conversation = getCurrentConversation();

  if (!conversation) return;

  state.generating = true;
  state.abortController = new AbortController();

  updateSendButton();
  showTyping(true);

  const assistantMessage = {
    id: createId("msg"),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    streaming: true
  };

  conversation.messages.push(assistantMessage);
  conversation.updatedAt = Date.now();

  renderCurrentConversation();
  scrollChatToBottom();

  try {
    const payloadMessages = buildApiMessages(
      conversation.messages
    );

    const response = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        messages: payloadMessages,

        research: state.research,

        responseLength: state.responseLength,

        responseStyle: state.responseStyle,

        memory: state.memory,

        customInstructions:
          state.customInstructions
      }),

      signal: state.abortController.signal
    });

    if (!response.ok) {
      let errorMessage = "Something went wrong.";

      try {
        const errorData = await response.json();

        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch (_) {
        // Ignore invalid JSON error response.
      }

      throw new Error(errorMessage);
    }

    await readStreamingResponse(
      response,
      assistantMessage
    );

    assistantMessage.streaming = false;

    conversation.updatedAt = Date.now();

    persistConversations();

    renderCurrentConversation();
    updateContextIndicator();

  } catch (error) {
    if (error.name === "AbortError") {
      if (!assistantMessage.content.trim()) {
        conversation.messages =
          conversation.messages.filter(
            (message) =>
              message.id !== assistantMessage.id
          );
      } else {
        assistantMessage.streaming = false;
        assistantMessage.content +=
          "\n\n*Generation stopped.*";
      }

      renderCurrentConversation();
    } else {
      console.error("OZLIND AI error:", error);

      assistantMessage.streaming = false;

      if (!assistantMessage.content.trim()) {
        conversation.messages =
          conversation.messages.filter(
            (message) =>
              message.id !== assistantMessage.id
          );
      }

      renderCurrentConversation();

      showToast(
        error.message ||
          "Unable to generate a response."
      );
    }

    persistConversations();

  } finally {
    state.generating = false;
    state.abortController = null;

    showTyping(false);
    updateSendButton();
    updateContextIndicator();

    scrollChatToBottom();
  }
}

/* ---------------------------------------------------------
   API MESSAGE BUILDER
--------------------------------------------------------- */

function buildApiMessages(messages) {
  const result = [];

  for (const message of messages) {
    if (!message || !message.role) continue;

    if (
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      continue;
    }

    const text =
      typeof message.content === "string"
        ? message.content
        : "";

    if (
      message.role === "user" &&
      Array.isArray(message.attachments) &&
      message.attachments.length
    ) {
      const content = [];

      if (text) {
        content.push({
          type: "text",
          text
        });
      }

      for (const attachment of message.attachments) {
        if (
          attachment.type?.startsWith("image/") &&
          attachment.dataUrl
        ) {
          content.push({
            type: "image_url",
            image_url: {
              url: attachment.dataUrl
            }
          });
        }
      }

      if (content.length > 0) {
        result.push({
          role: "user",
          content
        });

        continue;
      }
    }

    result.push({
      role: message.role,
      content: text
    });
  }

  return result;
}

/* ---------------------------------------------------------
   STREAMING RESPONSE
--------------------------------------------------------- */

async function readStreamingResponse(
  response,
  assistantMessage
) {
  const contentType =
    response.headers.get("content-type") || "";

  if (
    contentType.includes("text/event-stream") &&
    response.body
  ) {
    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true
      });

      const lines =
        buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed =
          line.trim();

        if (!trimmed) continue;

        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const data =
          trimmed.slice(5).trim();

        if (data === "[DONE]") {
          continue;
        }

        try {
          const parsed =
            JSON.parse(data);

          const delta =
            parsed?.choices?.[0]?.delta?.content ||
            parsed?.content ||
            "";

          if (delta) {
            assistantMessage.content += delta;

            renderCurrentConversation(
              false
            );

            scrollChatToBottom();
          }
        } catch (_) {
          // Ignore malformed stream chunks.
        }
      }
    }

    return;
  }

  const data = await response.json();

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.content ||
    data?.message ||
    "";

  assistantMessage.content =
    typeof content === "string"
      ? content
      : JSON.stringify(content);
}

/* ---------------------------------------------------------
   STOP GENERATION
--------------------------------------------------------- */

function stopGeneration() {
  if (
    state.generating &&
    state.abortController
  ) {
    state.abortController.abort();
  }
}

/* ---------------------------------------------------------
   TYPING INDICATOR
--------------------------------------------------------- */

function showTyping(show) {
  if (!els.typingIndicator) return;

  els.typingIndicator.classList.toggle(
    "active",
    Boolean(show)
  );
}

/* ---------------------------------------------------------
   SEND BUTTON
--------------------------------------------------------- */

function updateSendButton() {
  if (!els.sendBtn) return;

  if (state.generating) {
    els.sendBtn.textContent = "Stop";
    els.sendBtn.setAttribute(
      "aria-label",
      "Stop generation"
    );
    els.sendBtn.classList.add("stop-mode");
    return;
  }

  els.sendBtn.textContent = "Send";
  els.sendBtn.setAttribute(
    "aria-label",
    "Send message"
  );
  els.sendBtn.classList.remove("stop-mode");
}

/* ---------------------------------------------------------
   RENDER CHAT
--------------------------------------------------------- */

function renderCurrentConversation(
  shouldScroll = true
) {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  if (els.chatTitle) {
    els.chatTitle.textContent =
      conversation.title || "New conversation";
  }

  if (els.chatMessages) {
    els.chatMessages.innerHTML = "";

    if (
      !conversation.messages ||
      conversation.messages.length === 0
    ) {
      renderEmptyChatState();
    } else {
      conversation.messages.forEach(
        renderMessage
      );
    }
  }

  updateFavoriteButton();

  updateContextIndicator();

  if (shouldScroll) {
    requestAnimationFrame(
      scrollChatToBottom
    );
  }
}

/* ---------------------------------------------------------
   EMPTY CHAT
--------------------------------------------------------- */

function renderEmptyChatState() {
  if (!els.chatMessages) return;

  const empty = document.createElement("div");

  empty.className = "empty-chat";

  empty.innerHTML = `
    <div class="empty-chat-icon">✦</div>
    <h3>How can I help you?</h3>
    <p>
      Ask OZLIND anything, upload an image,
      or turn on web research for current information.
    </p>
  `;

  els.chatMessages.appendChild(empty);
}

/* ---------------------------------------------------------
   MESSAGE RENDERING
--------------------------------------------------------- */

function renderMessage(message) {
  const wrapper =
    document.createElement("article");

  wrapper.className =
    `message ${message.role}`;

  wrapper.dataset.messageId =
    message.id;

  const avatar =
    document.createElement("div");

  avatar.className = "message-avatar";

  avatar.textContent =
    message.role === "user"
      ? "You"
      : "O";

  const body =
    document.createElement("div");

  body.className = "message-body";

  const content =
    document.createElement("div");

  content.className = "message-content";

  if (
    message.role === "user" &&
    Array.isArray(message.attachments)
  ) {
    renderMessageAttachments(
      message.attachments,
      content
    );
  }

  if (message.content) {
    content.insertAdjacentHTML(
      "beforeend",
      renderMarkdown(
        message.content
      )
    );
  }

  body.appendChild(content);

  const actions =
    createMessageActions(message);

  body.appendChild(actions);

  wrapper.appendChild(avatar);
  wrapper.appendChild(body);

  els.chatMessages?.appendChild(
    wrapper
  );
}

/* ---------------------------------------------------------
   ATTACHMENT RENDERING
--------------------------------------------------------- */

function renderMessageAttachments(
  attachments,
  container
) {
  if (!Array.isArray(attachments)) return;

  const group =
    document.createElement("div");

  group.className =
    "message-attachments";

  attachments.forEach((attachment) => {
    if (
      attachment.type?.startsWith("image/") &&
      attachment.dataUrl
    ) {
      const image =
        document.createElement("img");

      image.src =
        attachment.dataUrl;

      image.alt =
        attachment.name ||
        "Uploaded image";

      image.loading = "lazy";

      group.appendChild(image);
    } else {
      const file =
        document.createElement("div");

      file.className =
        "message-file";

      file.textContent =
        attachment.name ||
        "Attachment";

      group.appendChild(file);
    }
  });

  container.appendChild(group);
}

/* ---------------------------------------------------------
   MESSAGE ACTIONS
--------------------------------------------------------- */

function createMessageActions(message) {
  const actions =
    document.createElement("div");

  actions.className =
    "message-actions";

  if (
    message.role === "assistant"
  ) {
    const copy =
      createActionButton(
        "Copy",
        "copy"
      );

    copy.addEventListener(
      "click",
      () => {
        copyText(
          message.content || ""
        );
      }
    );

    actions.appendChild(copy);

    const speak =
      createActionButton(
        "Read aloud",
        "speak"
      );

    speak.addEventListener(
      "click",
      () => {
        speakText(
          message.content || ""
        );
      }
    );

    actions.appendChild(speak);

    const regenerate =
      createActionButton(
        "Regenerate",
        "regenerate"
      );

    regenerate.addEventListener(
      "click",
      () => {
        regenerateMessage(
          message.id
        );
      }
    );

    actions.appendChild(
      regenerate
    );
  }

  const edit =
    createActionButton(
      "Edit",
      "edit"
    );

  edit.addEventListener(
    "click",
    () => {
      editMessage(message.id);
    }
  );

  actions.appendChild(edit);

  const remove =
    createActionButton(
      "Delete",
      "delete"
    );

  remove.addEventListener(
    "click",
    () => {
      deleteMessage(message.id);
    }
  );

  actions.appendChild(remove);

  return actions;
}

function createActionButton(
  label,
  action
) {
  const button =
    document.createElement("button");

  button.type = "button";

  button.className =
    "message-action";

  button.dataset.action =
    action;

  button.title = label;
  button.setAttribute(
    "aria-label",
    label
  );

  button.textContent = label;

  return button;
}

/* ---------------------------------------------------------
   MARKDOWN
--------------------------------------------------------- */

function renderMarkdown(text) {
  if (!text) return "";

  let safe = escapeHTML(
    String(text)
  );

  const codeBlocks = [];

  safe = safe.replace(
    /```([\w+-]*)\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const index =
        codeBlocks.length;

      codeBlocks.push({
        language:
          language || "code",
        code
      });

      return `@@CODEBLOCK_${index}@@`;
    }
  );

  safe = safe.replace(
    /^### (.+)$/gm,
    "<h4>$1</h4>"
  );

  safe = safe.replace(
    /^## (.+)$/gm,
    "<h3>$1</h3>"
  );

  safe = safe.replace(
    /^# (.+)$/gm,
    "<h2>$1</h2>"
  );

  safe = safe.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  safe = safe.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  safe = safe.replace(
    /^\s*[-*]\s+(.+)$/gm,
    "<li>$1</li>"
  );

  safe = safe.replace(
    /(<li>.*<\/li>)/gs,
    "<ul>$1</ul>"
  );

  safe = safe.replace(
    /\n{2,}/g,
    "</p><p>"
  );

  safe = safe.replace(
    /\n/g,
    "<br>"
  );

  safe = `<p>${safe}</p>`;

  codeBlocks.forEach(
    (block, index) => {
      const codeHTML =
        `<pre class="code-block"><code>${block.code}</code></pre>`;

      safe = safe.replace(
        `@@CODEBLOCK_${index}@@`,
        codeHTML
      );
    }
  );

  return safe;
}

function escapeHTML(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------------------------------------
   COPY
--------------------------------------------------------- */

async function copyText(text) {
  if (!text) {
    showToast("Nothing to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);

    showToast("Copied to clipboard.");
  } catch (error) {
    const textarea =
      document.createElement("textarea");

    textarea.value = text;

    textarea.style.position =
      "fixed";

    textarea.style.opacity = "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    try {
      document.execCommand("copy");
      showToast(
        "Copied to clipboard."
      );
    } catch (_) {
      showToast(
        "Copy failed."
      );
    }

    textarea.remove();
  }
}

/* ---------------------------------------------------------
   READ ALOUD
--------------------------------------------------------- */

function speakText(text) {
  if (!text) return;

  if (!("speechSynthesis" in window)) {
    showToast(
      "Read aloud is not supported on this device."
    );

    return;
  }

  window.speechSynthesis.cancel();

  const cleanText =
    text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[#*_`]/g, "");

  const utterance =
    new SpeechSynthesisUtterance(
      cleanText
    );

  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(
    utterance
  );
}

/* ---------------------------------------------------------
   EDIT MESSAGE
--------------------------------------------------------- */

function editMessage(messageId) {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  const message =
    conversation.messages.find(
      (item) =>
        item.id === messageId
    );

  if (!message) return;

  if (!els.messageInput) return;

  els.messageInput.value =
    message.content || "";

  state.editingMessageId =
    messageId;

  autoResizeTextarea();
  els.messageInput.focus();

  showToast(
    "Edit the message and press Send."
  );
}

/* ---------------------------------------------------------
   DELETE MESSAGE
--------------------------------------------------------- */

function deleteMessage(messageId) {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  const index =
    conversation.messages.findIndex(
      (message) =>
        message.id === messageId
    );

  if (index === -1) return;

  conversation.messages.splice(
    index,
    1
  );

  conversation.updatedAt =
    Date.now();

  persistConversations();
  renderCurrentConversation();

  showToast("Message deleted.");
}

/* ---------------------------------------------------------
   REGENERATE
--------------------------------------------------------- */

async function regenerateMessage(
  messageId
) {
  if (state.generating) {
    showToast(
      "Please wait for the current response."
    );

    return;
  }

  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  const index =
    conversation.messages.findIndex(
      (message) =>
        message.id === messageId
    );

  if (index === -1) return;

  const message =
    conversation.messages[index];

  if (message.role !== "assistant") {
    return;
  }

  conversation.messages.splice(
    index,
    1
  );

  persistConversations();
  renderCurrentConversation();

  await generateAssistantResponse();
}

/* ---------------------------------------------------------
   ATTACHMENTS
--------------------------------------------------------- */

function setupAttachments() {
  els.fileInput?.addEventListener(
    "change",
    async (event) => {
      const files =
        Array.from(
          event.target.files || []
        );

      if (!files.length) return;

      await addFiles(files);

      event.target.value = "";
    }
  );
}

async function addFiles(files) {
  const maxFiles = 5;
  const maxSize =
    10 * 1024 * 1024;

  for (const file of files) {
    if (
      state.attachments.length >=
      maxFiles
    ) {
      showToast(
        `Maximum ${maxFiles} files allowed.`
      );

      break;
    }

    if (file.size > maxSize) {
      showToast(
        `${file.name} is larger than 10 MB.`
      );

      continue;
    }

    try {
      const dataUrl =
        await readFileAsDataURL(
          file
        );

      state.attachments.push({
        id: createId("file"),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      });

    } catch (error) {
      console.error(
        "Attachment error:",
        error
      );

      showToast(
        `Could not read ${file.name}.`
      );
    }
  }

  renderAttachmentPreview();
}

function readFileAsDataURL(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          reader.result
        );

      reader.onerror = () =>
        reject(
          reader.error
        );

      reader.readAsDataURL(
        file
      );
    }
  );
}

function renderAttachmentPreview() {
  if (!els.attachmentPreview)
    return;

  els.attachmentPreview.innerHTML =
    "";

  if (
    state.attachments.length ===
    0
  ) {
    els.attachmentPreview.classList.remove(
      "active"
    );

    return;
  }

  els.attachmentPreview.classList.add(
    "active"
  );

  state.attachments.forEach(
    (attachment) => {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "attachment-item";

      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        attachment.name;

      const remove =
        document.createElement(
          "button"
        );

      remove.type = "button";

      remove.textContent = "×";

      remove.title =
        "Remove attachment";

      remove.addEventListener(
        "click",
        () => {
          removeAttachment(
            attachment.id
          );
        }
      );

      item.appendChild(name);
      item.appendChild(remove);

      els.attachmentPreview.appendChild(
        item
      );
    }
  );
}

function removeAttachment(
  attachmentId
) {
  state.attachments =
    state.attachments.filter(
      (attachment) =>
        attachment.id !==
        attachmentId
    );

  renderAttachmentPreview();
}

function clearAttachments() {
  state.attachments = [];

  renderAttachmentPreview();

  if (els.fileInput) {
    els.fileInput.value = "";
  }
}

/* ---------------------------------------------------------
   RESEARCH
--------------------------------------------------------- */

function toggleResearch() {
  state.research = !state.research;

  els.researchBtn?.classList.toggle(
    "active",
    state.research
  );

  els.researchBtn?.setAttribute(
    "aria-pressed",
    String(state.research)
  );

  showToast(
    state.research
      ? "Web research enabled."
      : "Web research disabled."
  );
}

/* ---------------------------------------------------------
   VOICE INPUT
--------------------------------------------------------- */

function setupVoiceInput() {
  if (!els.voiceInputBtn) return;

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    els.voiceInputBtn.disabled = true;
    els.voiceInputBtn.title =
      "Voice input is not supported here.";

    return;
  }

  state.recognition =
    new SpeechRecognition();

  state.recognition.lang =
    navigator.language || "en-US";

  state.recognition.interimResults =
    true;

  state.recognition.continuous =
    false;

  state.recognition.onstart =
    () => {
      state.listening = true;

      els.voiceInputBtn.classList.add(
        "active"
      );

      showToast(
        "Listening..."
      );
    };

  state.recognition.onresult =
    (event) => {
      let transcript = "";

      for (
        let i =
          event.resultIndex;
        i <
        event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]
            .transcript;
      }

      if (els.messageInput) {
        els.messageInput.value =
          transcript;

        autoResizeTextarea();
      }
    };

  state.recognition.onerror =
    (event) => {
      console.warn(
        "Speech recognition error:",
        event.error
      );

      showToast(
        "Voice input could not be used."
      );
    };

  state.recognition.onend =
    () => {
      state.listening = false;

      els.voiceInputBtn.classList.remove(
        "active"
      );
    };

  els.voiceInputBtn.addEventListener(
    "click",
    toggleVoiceInput
  );
}

function toggleVoiceInput() {
  if (!state.recognition) {
    showToast(
      "Voice input is unavailable."
    );

    return;
  }

  if (state.listening) {
    state.recognition.stop();
    return;
  }

  try {
    state.recognition.start();
  } catch (error) {
    console.warn(
      "Voice start error:",
      error
    );
  }
}

/* ---------------------------------------------------------
   HISTORY
--------------------------------------------------------- */

function setupHistory() {
  els.historySearch?.addEventListener(
    "input",
    () => {
      state.searchQuery =
        els.historySearch.value
          .trim()
          .toLowerCase();

      renderHistory();
    }
  );

  renderHistory();
}

function renderHistory() {
  if (!els.historyList) return;

  els.historyList.innerHTML =
    "";

  let conversations =
    [...state.conversations];

  if (state.searchQuery) {
    conversations =
      conversations.filter(
        (conversation) =>
          conversation.title
            ?.toLowerCase()
            .includes(
              state.searchQuery
            ) ||
          conversation.messages?.some(
            (message) =>
              message.content
                ?.toLowerCase()
                .includes(
                  state.searchQuery
                )
          )
      );
  }

  if (conversations.length === 0) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "history-empty";

    empty.textContent =
      state.searchQuery
        ? "No matching conversations."
        : "No conversations yet.";

    els.historyList.appendChild(
      empty
    );

    return;
  }

  conversations.forEach(
    (conversation) => {
      const item =
        document.createElement(
          "button"
        );

      item.type = "button";

      item.className =
        "history-item";

      if (
        conversation.id ===
        state.currentConversationId
      ) {
        item.classList.add(
          "active"
        );
      }

      const title =
        document.createElement(
          "strong"
        );

      title.textContent =
        conversation.title ||
        "New conversation";

      const meta =
        document.createElement(
          "span"
        );

      meta.textContent =
        formatDate(
          conversation.updatedAt
        );

      item.appendChild(title);
      item.appendChild(meta);

      item.addEventListener(
        "click",
        () => {
          state.currentConversationId =
            conversation.id;

          persistConversations();
          renderCurrentConversation();

          showPage("chat");
        }
      );

      els.historyList.appendChild(
        item
      );
    }
  );
}

/* ---------------------------------------------------------
   FAVORITES
--------------------------------------------------------- */

function toggleCurrentFavorite() {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  conversation.favorite =
    !conversation.favorite;

  conversation.updatedAt =
    Date.now();

  if (conversation.favorite) {
    if (
      !state.favorites.includes(
        conversation.id
      )
    ) {
      state.favorites.push(
        conversation.id
      );
    }
  } else {
    state.favorites =
      state.favorites.filter(
        (id) =>
          id !== conversation.id
      );
  }

  saveJSON(
    STORAGE.favorites,
    state.favorites
  );

  persistConversations();

  updateFavoriteButton();

  showToast(
    conversation.favorite
      ? "Added to favorites."
      : "Removed from favorites."
  );
}

function updateFavoriteButton() {
  if (!els.favoriteChatBtn)
    return;

  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  els.favoriteChatBtn.classList.toggle(
    "active",
    Boolean(
      conversation.favorite
    )
  );

  els.favoriteChatBtn.textContent =
    conversation.favorite
      ? "★"
      : "☆";
}

function renderFavorites() {
  const page =
    document.querySelector(
      '[data-page="favorites"]'
    );

  if (!page) return;

  const container =
    page.querySelector(
      ".favorites-list"
    ) ||
    page.querySelector(
      ".history-list"
    );

  if (!container) return;

  container.innerHTML = "";

  const favorites =
    state.conversations.filter(
      (conversation) =>
        conversation.favorite ||
        state.favorites.includes(
          conversation.id
        )
    );

  if (!favorites.length) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "history-empty";

    empty.textContent =
      "No favorite conversations yet.";

    container.appendChild(
      empty
    );

    return;
  }

  favorites.forEach(
    (conversation) => {
      const item =
        document.createElement(
          "button"
        );

      item.type = "button";
      item.className =
        "history-item";

      const title =
        document.createElement(
          "strong"
        );

      title.textContent =
        conversation.title ||
        "Conversation";

      const meta =
        document.createElement(
          "span"
        );

      meta.textContent =
        formatDate(
          conversation.updatedAt
        );

      item.appendChild(title);
      item.appendChild(meta);

      item.addEventListener(
        "click",
        () => {
          state.currentConversationId =
            conversation.id;

          persistConversations();

          renderCurrentConversation();

          showPage("chat");
        }
      );

      container.appendChild(
        item
      );
    }
  );
}

/* ---------------------------------------------------------
   SETTINGS
--------------------------------------------------------- */

function setupSettings() {
  document
    .querySelectorAll(
      ".theme-option"
    )
    .forEach((option) => {
      option.addEventListener(
        "click",
        () => {
          const theme =
            option.dataset.theme;

          if (!theme) return;

          state.theme = theme;

          localStorage.setItem(
            STORAGE.theme,
            theme
          );

          applyTheme(theme);
          syncSettingsUI();

          showToast(
            `Theme: ${theme}`
          );
        }
      );
    });

  document
    .querySelectorAll(
      '[data-action="save-instructions"]'
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        saveCustomInstructions
      );
    });

  document
    .querySelectorAll(
      '[data-action="delete-data"]'
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        deleteAllData
      );
    });
}

function syncSettingsUI() {
  if (els.customInstructions) {
    els.customInstructions.value =
      state.customInstructions;
  }

  document
    .querySelectorAll(
      ".theme-option"
    )
    .forEach((option) => {
      option.classList.toggle(
        "active",
        option.dataset.theme ===
          state.theme
      );
    });
}

function saveCustomInstructions() {
  state.customInstructions =
    els.customInstructions?.value
      .trim() || "";

  localStorage.setItem(
    STORAGE.customInstructions,
    state.customInstructions
  );

  showToast(
    "Instructions saved."
  );
}

/* ---------------------------------------------------------
   DELETE ALL DATA
--------------------------------------------------------- */

function deleteAllData() {
  const confirmed =
    window.confirm(
      "Delete all OZLIND conversations and local settings?"
    );

  if (!confirmed) return;

  if (state.generating) {
    stopGeneration();
  }

  Object.values(STORAGE).forEach(
    (key) => {
      localStorage.removeItem(key);
    }
  );

  state.conversations = [];
  state.currentConversationId = null;
  state.attachments = [];
  state.favorites = [];
  state.customInstructions = "";

  ensureConversation();

  clearAttachments();

  renderCurrentConversation();

  syncControls();

  showPage("home");

  showToast(
    "All local OZLIND data deleted."
  );
}

/* ---------------------------------------------------------
   THEME
--------------------------------------------------------- */

function applyTheme(theme) {
  const root =
    document.documentElement;

  if (theme === "system") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    root.dataset.theme =
      prefersDark
        ? "dark"
        : "light";

    root.removeAttribute(
      "data-theme-preference"
    );

    return;
  }

  root.dataset.theme =
    theme;

  root.dataset.themePreference =
    theme;
}

function setupThemeButton() {
  if (!els.themeButton) return;

  els.themeButton.addEventListener(
    "click",
    cycleTheme
  );
}

function cycleTheme() {
  const order = [
    "dark",
    "light",
    "system"
  ];

  const current =
    order.indexOf(
      state.theme
    );

  const next =
    order[
      (current + 1) %
        order.length
    ];

  state.theme = next;

  localStorage.setItem(
    STORAGE.theme,
    next
  );

  applyTheme(next);
  syncSettingsUI();

  showToast(
    `Theme: ${next}`
  );
}

/* ---------------------------------------------------------
   GLOBAL SEARCH
--------------------------------------------------------- */

function setupGlobalSearch() {
  els.globalSearch?.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter")
        return;

      const query =
        els.globalSearch.value.trim();

      if (!query) return;

      if (els.historySearch) {
        els.historySearch.value =
          query;

        state.searchQuery =
          query.toLowerCase();
      }

      showPage("history");
      renderHistory();
    }
  );
}

/* ---------------------------------------------------------
   CLEAR BUTTON
--------------------------------------------------------- */

function setupClearButton() {
  els.clearButton?.addEventListener(
    "click",
    () => {
      if (state.generating) {
        stopGeneration();
      }

      const conversation =
        getCurrentConversation();

      if (!conversation) return;

      if (
        conversation.messages.length ===
        0
      ) {
        showToast(
          "This chat is already empty."
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Clear messages from this conversation?"
        );

      if (!confirmed) return;

      conversation.messages = [];
      conversation.title =
        "New conversation";

      conversation.updatedAt =
        Date.now();

      persistConversations();

      renderCurrentConversation();

      showToast(
        "Conversation cleared."
      );
    }
  );
}

/* ---------------------------------------------------------
   EXPORT
--------------------------------------------------------- */

function exportCurrentConversation() {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  let text =
    `${conversation.title}\n`;

  text +=
    `${"=".repeat(
      conversation.title.length
    )}\n\n`;

  conversation.messages.forEach(
    (message) => {
      const role =
        message.role === "user"
          ? "You"
          : "OZLIND";

      text += `${role}:\n`;
      text += `${message.content || ""}\n\n`;
    }
  );

  const blob =
    new Blob(
      [text],
      {
        type: "text/plain;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `${sanitizeFilename(
      conversation.title
    ) || "ozlind-chat"}.txt`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  showToast(
    "Conversation exported."
  );
}

/* ---------------------------------------------------------
   CONTEXT INDICATOR
--------------------------------------------------------- */

function updateContextIndicator() {
  const conversation =
    getCurrentConversation();

  let total = 0;

  if (conversation) {
    total += JSON.stringify(
      conversation.messages
    ).length;
  }

  total +=
    els.messageInput?.value
      ?.length || 0;

  const max =
    50000;

  const percent =
    Math.min(
      100,
      Math.round(
        (total / max) * 100
      )
    );

  if (els.contextProgress) {
    els.contextProgress.style.width =
      `${percent}%`;
  }

  if (els.contextText) {
    els.contextText.textContent =
      `${percent}% context used`;
  }
}

/* ---------------------------------------------------------
   TEXTAREA
--------------------------------------------------------- */

function autoResizeTextarea() {
  if (!els.messageInput) return;

  els.messageInput.style.height =
    "auto";

  els.messageInput.style.height =
    `${Math.min(
      els.messageInput.scrollHeight,
      180
    )}px`;
}

/* ---------------------------------------------------------
   SCROLL
--------------------------------------------------------- */

function scrollChatToBottom() {
  if (!els.chatMessages) return;

  els.chatMessages.scrollTop =
    els.chatMessages.scrollHeight;
}

/* ---------------------------------------------------------
   TITLE GENERATION
--------------------------------------------------------- */

function generateTitle(text) {
  if (!text) {
    return "New conversation";
  }

  const cleaned =
    text
      .replace(/\s+/g, " ")
      .trim();

  if (!cleaned) {
    return "New conversation";
  }

  const maxLength = 42;

  if (
    cleaned.length <=
    maxLength
  ) {
    return cleaned;
  }

  return (
    cleaned
      .slice(0, maxLength)
      .trimEnd() + "…"
  );
}

/* ---------------------------------------------------------
   DATE
--------------------------------------------------------- */

function formatDate(timestamp) {
  if (!timestamp) return "";

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}

/* ---------------------------------------------------------
   FILENAME
--------------------------------------------------------- */

function sanitizeFilename(name) {
  return String(name || "")
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/* ---------------------------------------------------------
   TOAST
--------------------------------------------------------- */

let toastTimer = null;

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent =
    message;

  els.toast.classList.add(
    "show"
  );

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => {
      els.toast?.classList.remove(
        "show"
      );
    },
    2600
  );
}

/* ---------------------------------------------------------
   KEYBOARD SHORTCUTS
--------------------------------------------------------- */

function setupKeyboardShortcuts() {
  setupThemeButton();
  setupGlobalSearch();
  setupClearButton();

  document.addEventListener(
    "keydown",
    (event) => {
      const isMac =
        navigator.platform
          .toUpperCase()
          .includes("MAC");

      const modifier =
        isMac
          ? event.metaKey
          : event.ctrlKey;

      if (
        modifier &&
        event.key.toLowerCase() ===
          "k"
      ) {
        event.preventDefault();

        els.globalSearch?.focus();
      }

      if (
        modifier &&
        event.key.toLowerCase() ===
          "n"
      ) {
        event.preventDefault();

        newConversation();
      }

      if (
        event.key === "Escape" &&
        state.generating
      ) {
        stopGeneration();
      }

      if (
        event.key === "Escape"
      ) {
        closeSidebar();
      }
    }
  );
}

/* ---------------------------------------------------------
   SYSTEM THEME CHANGE
--------------------------------------------------------- */

if (window.matchMedia) {
  const mediaQuery =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

  mediaQuery.addEventListener?.(
    "change",
    () => {
      if (
        state.theme ===
        "system"
      ) {
        applyTheme("system");
      }
    }
  );
}

/* ---------------------------------------------------------
   PAGE LOAD SAFETY
--------------------------------------------------------- */

window.addEventListener(
  "beforeunload",
  () => {
    if (state.generating) {
      state.abortController?.abort();
    }
  }
);

/* ---------------------------------------------------------
   DEBUG-FRIENDLY GLOBAL
--------------------------------------------------------- */

window.OZLIND = {
  state,

  newChat: newConversation,

  showPage,

  sendMessage,

  stopGeneration,

  toggleResearch,

  applyTheme
};
