"use strict";

/*
  OZLIND AI — chatbot.js
  Frontend controller for:
  - Chat UI
  - Local conversation history
  - Streaming AI responses
  - Image attachments
  - Web research toggle
  - Voice input
  - Read aloud
  - Copy / edit / delete / regenerate
  - Theme switching
  - Settings
*/

const OZLIND = {
  state: {
    conversations: [],
    currentConversationId: null,
    messages: [],
    attachments: [],
    generating: false,
    abortController: null,
    theme: "dark",
    memoryEnabled: true,
    responseStyle: "balanced",
    responseLength: "medium",
    researchEnabled: false,
    recognition: null,
    listening: false,
    customInstructions: "",
  },

  els: {},
};

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  loadLocalData();
  bindEvents();
  applyTheme(OZLIND.state.theme);
  renderHistory();
  updateContextMeter();
  showPage("home");
});

/* =========================================================
   DOM CACHE
========================================================= */

function cacheElements() {
  const $ = (selector) => document.querySelector(selector);

  OZLIND.els = {
    body: document.body,

    sidebar: $(".sidebar"),
    sidebarOverlay: $(".sidebar-overlay"),
    mobileMenu: $(".mobile-menu"),
    mobileClose: $(".mobile-close"),

    navItems: document.querySelectorAll(".nav-item"),

    newChat: $(".new-chat-btn"),

    pages: document.querySelectorAll(".page"),

    searchInput: $(".search-box input"),

    themeButton: document.querySelector(
      '[data-action="theme"]'
    ),

    clearButton: document.querySelector(
      '[data-action="clear"]'
    ),

    homeChatInput: $(".quick-input textarea"),
    homeSendButton: $(".quick-input .send-btn"),
    suggestions: document.querySelectorAll(".suggestion"),

    chatMessages: $(".chat-messages"),
    chatInput: $(".composer-box > textarea"),
    chatSendButton: $(".composer-box .send-btn"),

    attachmentInput: document.querySelector(
      "#attachmentInput"
    ),

    attachmentPreview: $(".attachment-preview"),

    responseLength: document.querySelector(
      "#responseLength"
    ),

    responseStyle: document.querySelector(
      "#responseStyle"
    ),

    memoryToggle: document.querySelector(
      "#memoryToggle"
    ),

    researchButton: document.querySelector(
      '[data-action="research"]'
    ),

    voiceButton: document.querySelector(
      '[data-action="voice"]'
    ),

    readAloudButton: document.querySelector(
      '[data-action="read-aloud"]'
    ),

    contextProgress: $(".context-progress"),
    contextCount: $(".context-info strong"),

    historyList: $(".history-list"),
    historySearch: $(".history-search input"),

    customInstructions: document.querySelector(
      "#customInstructions"
    ),

    saveInstructions: document.querySelector(
      '[data-action="save-instructions"]'
    ),

    deleteDataButton: document.querySelector(
      '[data-action="delete-data"]'
    ),

    themeOptions: document.querySelectorAll(
      ".theme-option"
    ),

    toast: $(".toast"),

    chatTitle: document.querySelector(
      ".chat-header h2"
    ),

    typingIndicator: $(".typing-indicator"),
  };
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  /* Navigation */
  OZLIND.els.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;

      if (!page) return;

      showPage(page);
      closeSidebar();
    });
  });

  /* New chat */
  if (OZLIND.els.newChat) {
    OZLIND.els.newChat.addEventListener(
      "click",
      startNewChat
    );
  }

  /* Mobile sidebar */
  if (OZLIND.els.mobileMenu) {
    OZLIND.els.mobileMenu.addEventListener(
      "click",
      openSidebar
    );
  }

  if (OZLIND.els.mobileClose) {
    OZLIND.els.mobileClose.addEventListener(
      "click",
      closeSidebar
    );
  }

  if (OZLIND.els.sidebarOverlay) {
    OZLIND.els.sidebarOverlay.addEventListener(
      "click",
      closeSidebar
    );
  }

  /* Home quick chat */
  if (OZLIND.els.homeSendButton) {
    OZLIND.els.homeSendButton.addEventListener(
      "click",
      () => {
        const value =
          OZLIND.els.homeChatInput?.value.trim();

        if (!value) return;

        OZLIND.els.homeChatInput.value = "";

        showPage("chat");

        setTimeout(() => {
          sendMessage(value);
        }, 50);
      }
    );
  }

  if (OZLIND.els.homeChatInput) {
    OZLIND.els.homeChatInput.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();

          OZLIND.els.homeSendButton?.click();
        }
      }
    );

    autoResizeTextarea(
      OZLIND.els.homeChatInput
    );
  }

  /* Suggestions */
  OZLIND.els.suggestions?.forEach((button) => {
    button.addEventListener("click", () => {
      const text =
        button.dataset.prompt ||
        button.textContent.trim();

      showPage("chat");

      setTimeout(() => {
        sendMessage(text);
      }, 50);
    });
  });

  /* Chat input */
  if (OZLIND.els.chatInput) {
    OZLIND.els.chatInput.addEventListener(
      "input",
      () => {
        autoResizeTextarea(
          OZLIND.els.chatInput
        );
      }
    );

    OZLIND.els.chatInput.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();

          OZLIND.els.chatSendButton?.click();
        }
      }
    );
  }

  /* Chat send */
  if (OZLIND.els.chatSendButton) {
    OZLIND.els.chatSendButton.addEventListener(
      "click",
      () => {
        if (OZLIND.state.generating) {
          stopGeneration();
          return;
        }

        const text =
          OZLIND.els.chatInput?.value.trim();

        if (!text && !OZLIND.state.attachments.length) {
          return;
        }

        sendMessage(text);
      }
    );
  }

  /* Attachments */
  if (OZLIND.els.attachmentInput) {
    OZLIND.els.attachmentInput.addEventListener(
      "change",
      handleAttachments
    );
  }

  /* Research */
  if (OZLIND.els.researchButton) {
    OZLIND.els.researchButton.addEventListener(
      "click",
      toggleResearch
    );
  }

  /* Voice */
  if (OZLIND.els.voiceButton) {
    OZLIND.els.voiceButton.addEventListener(
      "click",
      toggleVoiceInput
    );
  }

  /* Read aloud */
  if (OZLIND.els.readAloudButton) {
    OZLIND.els.readAloudButton.addEventListener(
      "click",
      readLatestResponse
    );
  }

  /* Settings */
  if (OZLIND.els.responseLength) {
    OZLIND.els.responseLength.addEventListener(
      "change",
      () => {
        OZLIND.state.responseLength =
          OZLIND.els.responseLength.value;

        saveLocalData();
      }
    );
  }

  if (OZLIND.els.responseStyle) {
    OZLIND.els.responseStyle.addEventListener(
      "change",
      () => {
        OZLIND.state.responseStyle =
          OZLIND.els.responseStyle.value;

        saveLocalData();
      }
    );
  }

  if (OZLIND.els.memoryToggle) {
    OZLIND.els.memoryToggle.addEventListener(
      "change",
      () => {
        OZLIND.state.memoryEnabled =
          OZLIND.els.memoryToggle.checked;

        saveLocalData();
      }
    );
  }

  /* History search */
  if (OZLIND.els.historySearch) {
    OZLIND.els.historySearch.addEventListener(
      "input",
      renderHistory
    );
  }

  /* Theme */
  OZLIND.els.themeOptions?.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;

      if (!theme) return;

      applyTheme(theme);
    });
  });

  /* Save instructions */
  if (OZLIND.els.saveInstructions) {
    OZLIND.els.saveInstructions.addEventListener(
      "click",
      saveInstructions
    );
  }

  /* Delete data */
  if (OZLIND.els.deleteDataButton) {
    OZLIND.els.deleteDataButton.addEventListener(
      "click",
      deleteLocalData
    );
  }

  /* Top theme button */
  if (OZLIND.els.themeButton) {
    OZLIND.els.themeButton.addEventListener(
      "click",
      cycleTheme
    );
  }

  /* Clear current chat */
  if (OZLIND.els.clearButton) {
    OZLIND.els.clearButton.addEventListener(
      "click",
      clearCurrentChat
    );
  }

  /* Message actions */
  document.addEventListener(
    "click",
    handleDynamicActions
  );

  /* Keyboard shortcuts */
  document.addEventListener(
    "keydown",
    handleKeyboardShortcuts
  );
}

/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageName) {
  OZLIND.els.pages?.forEach((page) => {
    page.classList.toggle(
      "active",
      page.dataset.page === pageName
    );
  });

  OZLIND.els.navItems?.forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  if (pageName === "chat") {
    if (!OZLIND.state.currentConversationId) {
      createConversation();
    }

    renderMessages();
  }
}

/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {
  OZLIND.els.sidebar?.classList.add("open");
  OZLIND.els.sidebarOverlay?.classList.add(
    "active"
  );
}

function closeSidebar() {
  OZLIND.els.sidebar?.classList.remove("open");
  OZLIND.els.sidebarOverlay?.classList.remove(
    "active"
  );
}

/* =========================================================
   CONVERSATIONS
========================================================= */

function createConversation() {
  const id =
    "chat_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 8);

  const conversation = {
    id,
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  OZLIND.state.conversations.unshift(
    conversation
  );

  OZLIND.state.currentConversationId = id;
  OZLIND.state.messages = [];

  saveLocalData();
  renderHistory();
}

function startNewChat() {
  OZLIND.state.currentConversationId = null;
  OZLIND.state.messages = [];
  OZLIND.state.attachments = [];

  createConversation();
  clearChatUI();
  showPage("chat");

  if (OZLIND.els.chatInput) {
    OZLIND.els.chatInput.value = "";
    autoResizeTextarea(
      OZLIND.els.chatInput
    );
  }

  renderAttachments();
  updateContextMeter();

  showToast("New chat started");
}

function getCurrentConversation() {
  return OZLIND.state.conversations.find(
    (conversation) =>
      conversation.id ===
      OZLIND.state.currentConversationId
  );
}

function saveCurrentConversation() {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  conversation.messages = [
    ...OZLIND.state.messages,
  ];

  conversation.updatedAt = Date.now();

  saveLocalData();
  renderHistory();
}

/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage(text) {
  if (OZLIND.state.generating) return;

  const cleanText = String(text || "").trim();

  if (
    !cleanText &&
    !OZLIND.state.attachments.length
  ) {
    return;
  }

  if (!OZLIND.state.currentConversationId) {
    createConversation();
  }

  showPage("chat");

  const userMessage = {
    id: createMessageId(),
    role: "user",
    content: cleanText,
    attachments:
      OZLIND.state.attachments.map((file) => ({
        name: file.name,
        type: file.type,
        dataUrl: file.dataUrl,
      })),
    createdAt: Date.now(),
  };

  OZLIND.state.messages.push(userMessage);

  updateConversationTitle(cleanText);

  OZLIND.state.attachments = [];

  if (OZLIND.els.chatInput) {
    OZLIND.els.chatInput.value = "";

    autoResizeTextarea(
      OZLIND.els.chatInput
    );
  }

  renderAttachments();
  renderMessages();
  updateContextMeter();
  saveCurrentConversation();

  await requestAssistantResponse();
}

/* =========================================================
   AI REQUEST
========================================================= */

async function requestAssistantResponse() {
  if (OZLIND.state.generating) return;

  OZLIND.state.generating = true;

  setGeneratingUI(true);

  const assistantMessage = {
    id: createMessageId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  };

  OZLIND.state.messages.push(
    assistantMessage
  );

  renderMessages();

  const messageElement =
    document.querySelector(
      `[data-message-id="${assistantMessage.id}"]`
    );

  const contentElement =
    messageElement?.querySelector(
      ".message-content"
    );

  OZLIND.state.abortController =
    new AbortController();

  try {
    const payloadMessages =
      buildApiMessages();

    const response = await fetch(
      "/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          messages: payloadMessages,

          research:
            OZLIND.state.researchEnabled,

          responseLength:
            OZLIND.state.responseLength,

          responseStyle:
            OZLIND.state.responseStyle,

          memory:
            OZLIND.state.memoryEnabled,

          customInstructions:
            OZLIND.state.customInstructions,
        }),

        signal:
          OZLIND.state.abortController.signal,
      }
    );

    if (!response.ok) {
      let errorMessage =
        "Unable to get a response.";

      try {
        const errorData =
          await response.json();

        if (errorData?.error) {
          errorMessage =
            errorData.error;
        }
      } catch {
        /* Ignore invalid JSON */
      }

      throw new Error(errorMessage);
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "text/event-stream"
      )
    ) {
      await consumeStream(
        response,
        assistantMessage,
        contentElement
      );
    } else {
      const data =
        await response.json();

      const reply =
        typeof data.reply === "string"
          ? data.reply
          : "I couldn't generate a response.";

      assistantMessage.content = reply;

      if (contentElement) {
        contentElement.innerHTML =
          renderMarkdown(reply);
      }
    }

    assistantMessage.content =
      assistantMessage.content.trim();

    if (!assistantMessage.content) {
      assistantMessage.content =
        "I couldn't generate a response. Please try again.";
    }

    saveCurrentConversation();
    updateContextMeter();
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      assistantMessage.content =
        assistantMessage.content ||
        "Generation stopped.";
    } else {
      assistantMessage.content =
        "Sorry, something went wrong while generating the response.\n\n" +
        escapeHtml(
          error?.message ||
            "Please try again."
        );
    }

    renderMessages();
    saveCurrentConversation();

    showToast(
      error?.name === "AbortError"
        ? "Generation stopped"
        : "AI request failed"
    );
  } finally {
    OZLIND.state.generating = false;
    OZLIND.state.abortController = null;

    setGeneratingUI(false);
    updateContextMeter();
  }
}

/* =========================================================
   API MESSAGE BUILDER
========================================================= */

function buildApiMessages() {
  const source =
    OZLIND.state.memoryEnabled
      ? OZLIND.state.messages
      : OZLIND.state.messages.slice(-6);

  return source.map((message) => {
    const content =
      message.content || "";

    if (
      message.role === "user" &&
      Array.isArray(message.attachments) &&
      message.attachments.length
    ) {
      const parts = [];

      if (content) {
        parts.push({
          type: "text",
          text: content,
        });
      }

      message.attachments.forEach(
        (attachment) => {
          if (
            attachment.dataUrl &&
            attachment.type?.startsWith(
              "image/"
            )
          ) {
            parts.push({
              type: "image_url",
              image_url: {
                url: attachment.dataUrl,
              },
            });
          }
        }
      );

      return {
        role: "user",
        content: parts,
      };
    }

    return {
      role: message.role,
      content,
    };
  });
}

/* =========================================================
   STREAM READER
========================================================= */

async function consumeStream(
  response,
  assistantMessage,
  contentElement
) {
  if (!response.body) {
    throw new Error(
      "Streaming is not supported by this connection."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder("utf-8");

  let buffer = "";

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) break;

    buffer += decoder.decode(
      value,
      {
        stream: true,
      }
    );

    const lines =
      buffer.split("\n");

    buffer =
      lines.pop() || "";

    for (const rawLine of lines) {
      const line =
        rawLine.trim();

      if (!line) continue;

      if (line === "data: [DONE]") {
        continue;
      }

      if (
        !line.startsWith("data:")
      ) {
        continue;
      }

      const rawData =
        line.slice(5).trim();

      if (!rawData) continue;

      let data;

      try {
        data = JSON.parse(rawData);
      } catch {
        continue;
      }

      const delta =
        data.delta ||
        data.content ||
        data.text ||
        data.reply ||
        "";

      if (
        typeof delta === "string" &&
        delta
      ) {
        assistantMessage.content +=
          delta;

        if (contentElement) {
          contentElement.innerHTML =
            renderMarkdown(
              assistantMessage.content
            );

          scrollChatToBottom();
        }
      }

      if (data.error) {
        throw new Error(
          data.error
        );
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    processStreamLine(
      buffer,
      assistantMessage,
      contentElement
    );
  }
}

function processStreamLine(
  line,
  assistantMessage,
  contentElement
) {
  const clean =
    line.trim();

  if (
    !clean.startsWith("data:")
  ) {
    return;
  }

  const raw =
    clean.slice(5).trim();

  if (!raw || raw === "[DONE]") {
    return;
  }

  try {
    const data =
      JSON.parse(raw);

    const delta =
      data.delta ||
      data.content ||
      data.text ||
      "";

    if (
      typeof delta === "string"
    ) {
      assistantMessage.content +=
        delta;

      if (contentElement) {
        contentElement.innerHTML =
          renderMarkdown(
            assistantMessage.content
          );
      }
    }
  } catch {
    /* Ignore malformed final chunk */
  }
}

/* =========================================================
   GENERATING UI
========================================================= */

function setGeneratingUI(isGenerating) {
  OZLIND.els.typingIndicator?.classList.toggle(
    "active",
    isGenerating
  );

  if (OZLIND.els.chatSendButton) {
    OZLIND.els.chatSendButton.innerHTML =
      isGenerating ? "■" : "➤";

    OZLIND.els.chatSendButton.title =
      isGenerating
        ? "Stop generation"
        : "Send message";
  }

  if (OZLIND.els.chatInput) {
    OZLIND.els.chatInput.disabled =
      isGenerating;
  }

  scrollChatToBottom();
}

/* =========================================================
   STOP
========================================================= */

function stopGeneration() {
  if (
    OZLIND.state.abortController
  ) {
    OZLIND.state.abortController.abort();
  }
}

/* =========================================================
   MESSAGE RENDERING
========================================================= */

function renderMessages() {
  const container =
    OZLIND.els.chatMessages;

  if (!container) return;

  if (!OZLIND.state.messages.length) {
    container.innerHTML = `
      <div class="welcome-message">
        <div class="assistant-avatar">✦</div>
        <div class="welcome-copy">
          <h3>Welcome to OZLIND AI</h3>
          <p>
            Ask anything, upload an image, research
            the web, write code, or brainstorm your
            next idea.
          </p>
        </div>
      </div>
    `;

    updateContextMeter();
    return;
  }

  container.innerHTML =
    OZLIND.state.messages
      .map(renderMessage)
      .join("");

  scrollChatToBottom();
}

function renderMessage(message) {
  const isUser =
    message.role === "user";

  const content =
    message.content || "";

  const attachments =
    Array.isArray(
      message.attachments
    )
      ? message.attachments
      : [];

  const attachmentHtml =
    attachments
      .filter(
        (file) =>
          file.type?.startsWith(
            "image/"
          )
      )
      .map(
        (file) => `
          <div class="attachment-item">
            <img
              src="${escapeAttribute(
                file.dataUrl
              )}"
              alt="${escapeAttribute(
                file.name ||
                  "Uploaded image"
              )}"
            />
          </div>
        `
      )
      .join("");

  return `
    <div
      class="message ${
        isUser
          ? "user"
          : "assistant"
      }"
      data-message-id="${escapeAttribute(
        message.id
      )}"
    >

      ${
        !isUser
          ? `<div class="message-avatar">✦</div>`
          : ""
      }

      <div class="message-body">

        ${
          attachmentHtml
            ? `<div class="attachment-preview">${attachmentHtml}</div>`
            : ""
        }

        <div class="message-content">
          ${
            content
              ? renderMarkdown(
                  content
                )
              : '<span class="typing-placeholder">Generating…</span>'
          }
        </div>

        <div class="message-actions">

          <button
            class="message-action"
            data-message-action="copy"
            title="Copy"
          >
            ⧉
          </button>

          ${
            isUser
              ? `
                <button
                  class="message-action"
                  data-message-action="edit"
                  title="Edit"
                >
                  ✎
                </button>

                <button
                  class="message-action"
                  data-message-action="delete"
                  title="Delete"
                >
                  ×
                </button>
              `
              : `
                <button
                  class="message-action"
                  data-message-action="regenerate"
                  title="Regenerate"
                >
                  ↻
                </button>

                <button
                  class="message-action"
                  data-message-action="read"
                  title="Read aloud"
                >
                  🔊
                </button>

                <button
                  class="message-action"
                  data-message-action="like"
                  title="Helpful"
                >
                  👍
                </button>

                <button
                  class="message-action"
                  data-message-action="dislike"
                  title="Not helpful"
                >
                  👎
                </button>
              `
          }

        </div>

      </div>

      ${
        isUser
          ? `<div class="message-avatar">You</div>`
          : ""
      }

    </div>
  `;
}

/* =========================================================
   DYNAMIC MESSAGE ACTIONS
========================================================= */

function handleDynamicActions(event) {
  const button =
    event.target.closest(
      "[data-message-action]"
    );

  if (!button) return;

  const messageElement =
    button.closest(
      "[data-message-id]"
    );

  if (!messageElement) return;

  const messageId =
    messageElement.dataset.messageId;

  const action =
    button.dataset.messageAction;

  handleMessageAction(
    action,
    messageId
  );
}

function handleMessageAction(
  action,
  messageId
) {
  const message =
    OZLIND.state.messages.find(
      (item) =>
        item.id === messageId
    );

  if (!message) return;

  switch (action) {
    case "copy":
      copyText(
        message.content
      );
      break;

    case "edit":
      editMessage(messageId);
      break;

    case "delete":
      deleteMessage(messageId);
      break;

    case "regenerate":
      regenerateMessage(
        messageId
      );
      break;

    case "read":
      speakText(
        message.content
      );
      break;

    case "like":
      showToast(
        "Thanks for the feedback 👍"
      );
      break;

    case "dislike":
      showToast(
        "Feedback recorded 👎"
      );
      break;

    default:
      break;
  }
}

/* =========================================================
   EDIT
========================================================= */

function editMessage(messageId) {
  const message =
    OZLIND.state.messages.find(
      (item) =>
        item.id === messageId
    );

  if (
    !message ||
    message.role !== "user"
  ) {
    return;
  }

  showPage("chat");

  if (OZLIND.els.chatInput) {
    OZLIND.els.chatInput.value =
      message.content || "";

    autoResizeTextarea(
      OZLIND.els.chatInput
    );

    OZLIND.els.chatInput.focus();
  }

  const index =
    OZLIND.state.messages.findIndex(
      (item) =>
        item.id === messageId
    );

  if (index !== -1) {
    OZLIND.state.messages =
      OZLIND.state.messages.slice(
        0,
        index
      );

    saveCurrentConversation();
    renderMessages();
    updateContextMeter();
  }

  showToast(
    "Edit your message and send again"
  );
}

/* =========================================================
   DELETE MESSAGE
========================================================= */

function deleteMessage(messageId) {
  OZLIND.state.messages =
    OZLIND.state.messages.filter(
      (message) =>
        message.id !== messageId
    );

  saveCurrentConversation();
  renderMessages();
  updateContextMeter();

  showToast("Message deleted");
}

/* =========================================================
   REGENERATE
========================================================= */

async function regenerateMessage(
  messageId
) {
  if (OZLIND.state.generating) {
    return;
  }

  const index =
    OZLIND.state.messages.findIndex(
      (message) =>
        message.id === messageId
    );

  if (index === -1) return;

  const message =
    OZLIND.state.messages[index];

  if (message.role !== "assistant") {
    return;
  }

  const previousUser =
    [...OZLIND.state.messages]
      .slice(0, index)
      .reverse()
      .find(
        (item) =>
          item.role === "user"
      );

  if (!previousUser) return;

  OZLIND.state.messages =
    OZLIND.state.messages.slice(
      0,
      index
    );

  renderMessages();
  saveCurrentConversation();

  await requestAssistantResponse();
}

/* =========================================================
   COPY
========================================================= */

async function copyText(text) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(
      stripMarkdown(text)
    );

    showToast("Copied");
  } catch {
    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      stripMarkdown(text);

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand("copy");

    textarea.remove();

    showToast("Copied");
  }
}

/* =========================================================
   MARKDOWN
========================================================= */

function renderMarkdown(text) {
  if (!text) return "";

  let html =
    escapeHtml(String(text));

  /* Code blocks */
  html = html.replace(
    /```([\s\S]*?)```/g,
    (_, code) => {
      const cleaned =
        code.replace(
          /^\w+\n/,
          ""
        );

      return `
        <div class="code-block">
          <div class="code-header">
            <span>CODE</span>
            <button
              class="code-copy"
              onclick="window.OZLINDCopyCode(this)"
            >
              Copy
            </button>
          </div>
          <pre><code>${cleaned.trim()}</code></pre>
        </div>
      `;
    }
  );

  /* Inline code */
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>'
  );

  /* Bold */
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  /* Italic */
  html = html.replace(
    /(^|[^\*])\*([^*\n]+)\*/g,
    "$1<em>$2</em>"
  );

  /* Headings */
  html = html.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>"
  );

  html = html.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>"
  );

  html = html.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>"
  );

  /* Links */
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /* Unordered lists */
  html = html.replace(
    /(?:^|\n)((?:[-*] .+(?:\n|$))+)/g,
    (_, block) => {
      const items =
        block
          .trim()
          .split("\n")
          .map(
            (line) =>
              `<li>${line
                .replace(
                  /^[-*]\s+/,
                  ""
                )
                .trim()}</li>`
          )
          .join("");

      return `\n<ul>${items}</ul>\n`;
    }
  );

  /* Ordered lists */
  html = html.replace(
    /(?:^|\n)((?:\d+\.\s.+(?:\n|$))+)/g,
    (_, block) => {
      const items =
        block
          .trim()
          .split("\n")
          .map(
            (line) =>
              `<li>${line
                .replace(
                  /^\d+\.\s+/,
                  ""
                )
                .trim()}</li>`
          )
          .join("");

      return `\n<ol>${items}</ol>\n`;
    }
  );

  /* Blockquotes */
  html = html.replace(
    /^>\s?(.*)$/gm,
    "<blockquote>$1</blockquote>"
  );

  /* Paragraphs / line breaks */
  const blocks =
    html
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed =
          block.trim();

        if (!trimmed) return "";

        if (
          /^<(h1|h2|h3|ul|ol|blockquote|div)/.test(
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
      .join("");

  return blocks;
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(
      /```[\s\S]*?```/g,
      ""
    )
    .replace(
      /[*_~`]/g,
      ""
    )
    .replace(
      /\[(.*?)\]\((.*?)\)/g,
      "$1"
    );
}

window.OZLINDCopyCode = function (
  button
) {
  const code =
    button
      .closest(".code-block")
      ?.querySelector("code")
      ?.textContent || "";

  copyText(code);
};

/* =========================================================
   ATTACHMENTS
========================================================= */

async function handleAttachments(event) {
  const files =
    Array.from(
      event.target.files || []
    );

  if (!files.length) return;

  const maxFiles = 4;

  const selected =
    files.slice(0, maxFiles);

  for (const file of selected) {
    if (!file.type.startsWith("image/")) {
      showToast(
        "Only image files are supported here"
      );

      continue;
    }

    if (
      file.size >
      8 * 1024 * 1024
    ) {
      showToast(
        `${file.name} is larger than 8 MB`
      );

      continue;
    }

    try {
      const dataUrl =
        await readFileAsDataURL(
          file
        );

      OZLIND.state.attachments.push(
        {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        }
      );
    } catch {
      showToast(
        `Couldn't read ${file.name}`
      );
    }
  }

  event.target.value = "";

  renderAttachments();
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

      reader.onerror = reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}

function renderAttachments() {
  const container =
    OZLIND.els.attachmentPreview;

  if (!container) return;

  if (
    !OZLIND.state.attachments.length
  ) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML =
    OZLIND.state.attachments
      .map(
        (file, index) => `
          <div
            class="attachment-item"
            title="${escapeAttribute(
              file.name
            )}"
          >
            <img
              src="${escapeAttribute(
                file.dataUrl
              )}"
              alt="${escapeAttribute(
                file.name
              )}"
            />

            <button
              class="attachment-remove"
              data-remove-attachment="${index}"
              type="button"
            >
              ×
            </button>
          </div>
        `
      )
      .join("");

  container
    .querySelectorAll(
      "[data-remove-attachment]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const index =
            Number(
              button.dataset
                .removeAttachment
            );

          OZLIND.state.attachments.splice(
            index,
            1
          );

          renderAttachments();
        }
      );
    });
}

/* =========================================================
   WEB RESEARCH
========================================================= */

function toggleResearch() {
  OZLIND.state.researchEnabled =
    !OZLIND.state.researchEnabled;

  OZLIND.els.researchButton?.classList.toggle(
    "active",
    OZLIND.state.researchEnabled
  );

  showToast(
    OZLIND.state.researchEnabled
      ? "Web research enabled"
      : "Web research disabled"
  );
}

/* =========================================================
   VOICE INPUT
========================================================= */

function toggleVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast(
      "Voice input is not supported in this browser"
    );

    return;
  }

  if (OZLIND.state.listening) {
    stopVoiceInput();
    return;
  }

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    navigator.language ||
    "en-US";

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    OZLIND.state.listening =
      true;

    OZLIND.els.voiceButton?.classList.add(
      "active"
    );

    showToast(
      "Listening…"
    );
  };

  recognition.onresult = (
    event
  ) => {
    let transcript = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      transcript +=
        event.results[i][0]
          .transcript;
    }

    if (OZLIND.els.chatInput) {
      OZLIND.els.chatInput.value =
        transcript;

      autoResizeTextarea(
        OZLIND.els.chatInput
      );
    }
  };

  recognition.onerror = () => {
    showToast(
      "Voice input failed"
    );
  };

  recognition.onend = () => {
    stopVoiceInput();
  };

  OZLIND.state.recognition =
    recognition;

  recognition.start();
}

function stopVoiceInput() {
  try {
    OZLIND.state.recognition?.stop();
  } catch {
    /* Already stopped */
  }

  OZLIND.state.recognition =
    null;

  OZLIND.state.listening =
    false;

  OZLIND.els.voiceButton?.classList.remove(
    "active"
  );
}

/* =========================================================
   TEXT TO SPEECH
========================================================= */

function readLatestResponse() {
  const latest =
    [...OZLIND.state.messages]
      .reverse()
      .find(
        (message) =>
          message.role ===
          "assistant" &&
          message.content
      );

  if (!latest) {
    showToast(
      "No response to read"
    );

    return;
  }

  speakText(
    latest.content
  );
}

function speakText(text) {
  if (
    !("speechSynthesis" in window)
  ) {
    showToast(
      "Read aloud is not supported"
    );

    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(
      stripMarkdown(text)
    );

  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(
    utterance
  );
}

/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {
  const container =
    OZLIND.els.historyList;

  if (!container) return;

  const search =
    (
      OZLIND.els.historySearch
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const conversations =
    OZLIND.state.conversations
      .filter(
        (conversation) =>
          !search ||
          conversation.title
            .toLowerCase()
            .includes(search)
      )
      .sort(
        (a, b) =>
          b.updatedAt -
          a.updatedAt
      );

  if (!conversations.length) {
    container.innerHTML = `
      <div class="side-card">
        <h3>No conversations yet</h3>
        <p>
          Your conversations will appear here.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    conversations
      .map(
        (conversation) => `
          <div
            class="history-item"
            data-conversation-id="${escapeAttribute(
              conversation.id
            )}"
          >

            <div class="history-icon">
              ✦
            </div>

            <div class="history-main">
              <strong>
                ${escapeHtml(
                  conversation.title
                )}
              </strong>

              <span>
                ${formatDate(
                  conversation.updatedAt
                )}
              </span>
            </div>

            <div class="history-actions">

              <button
                class="icon-btn"
                data-history-open="${escapeAttribute(
                  conversation.id
                )}"
                title="Open"
              >
                →
              </button>

              <button
                class="icon-btn"
                data-history-delete="${escapeAttribute(
                  conversation.id
                )}"
                title="Delete"
              >
                ×
              </button>

            </div>

          </div>
        `
      )
      .join("");

  container
    .querySelectorAll(
      "[data-history-open]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          loadConversation(
            button.dataset
              .historyOpen
          );
        }
      );
    });

  container
    .querySelectorAll(
      "[data-history-delete]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          deleteConversation(
            button.dataset
              .historyDelete
          );
        }
      );
    });
}

function loadConversation(id) {
  const conversation =
    OZLIND.state.conversations.find(
      (item) =>
        item.id === id
    );

  if (!conversation) return;

  OZLIND.state.currentConversationId =
    id;

  OZLIND.state.messages = [
    ...(conversation.messages || []),
  ];

  showPage("chat");

  updateChatTitle();
  renderMessages();
  updateContextMeter();

  closeSidebar();
}

function deleteConversation(id) {
  OZLIND.state.conversations =
    OZLIND.state.conversations.filter(
      (conversation) =>
        conversation.id !== id
    );

  if (
    OZLIND.state.currentConversationId ===
    id
  ) {
    OZLIND.state.currentConversationId =
      null;

    OZLIND.state.messages = [];
  }

  saveLocalData();
  renderHistory();

  showToast(
    "Conversation deleted"
  );
}

/* =========================================================
   TITLE
========================================================= */

function updateConversationTitle(
  text
) {
  const conversation =
    getCurrentConversation();

  if (!conversation) return;

  if (
    conversation.title ===
      "New conversation" &&
    text
  ) {
    conversation.title =
      createConversationTitle(
        text
      );
  }

  updateChatTitle();
}

function createConversationTitle(
  text
) {
  const clean =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!clean) {
    return "New conversation";
  }

  if (clean.length <= 42) {
    return clean;
  }

  return (
    clean.slice(0, 39) +
    "..."
  );
}

function updateChatTitle() {
  const conversation =
    getCurrentConversation();

  if (
    OZLIND.els.chatTitle &&
    conversation
  ) {
    OZLIND.els.chatTitle.textContent =
      conversation.title;
  }
}

/* =========================================================
   CLEAR CHAT
========================================================= */

function clearCurrentChat() {
  if (
    !OZLIND.state.messages.length
  ) {
    showToast(
      "Chat is already empty"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Clear this conversation?"
    );

  if (!confirmed) return;

  OZLIND.state.messages = [];

  saveCurrentConversation();
  renderMessages();
  updateContextMeter();

  showToast(
    "Conversation cleared"
  );
}

function clearChatUI() {
  if (OZLIND.els.chatMessages) {
    OZLIND.els.chatMessages.innerHTML = "";
  }
}

/* =========================================================
   CONTEXT
========================================================= */

function updateContextMeter() {
  const messages =
    OZLIND.state.messages;

  const text =
    messages
      .map(
        (message) =>
          message.content || ""
      )
      .join(" ");

  const approximateTokens =
    Math.ceil(
      text.length / 4
    );

  const maxTokens = 32000;

  const percentage = Math.min(
    100,
    Math.round(
      (approximateTokens /
        maxTokens) *
        100
    )
  );

  if (
    OZLIND.els.contextProgress
  ) {
    OZLIND.els.contextProgress.style.width =
      `${percentage}%`;
  }

  if (
    OZLIND.els.contextCount
  ) {
    OZLIND.els.contextCount.textContent =
      `${approximateTokens.toLocaleString()} tokens`;
  }
}

/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {
  if (
    !["dark", "light"].includes(
      theme
    )
  ) {
    theme = "dark";
  }

  OZLIND.state.theme =
    theme;

  document.documentElement.classList.toggle(
    "light",
    theme === "light"
  );

  OZLIND.els.themeOptions?.forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.theme ===
          theme
      );
    }
  );

  saveLocalData();
}

function cycleTheme() {
  const next =
    OZLIND.state.theme ===
    "dark"
      ? "light"
      : "dark";

  applyTheme(next);

  showToast(
    `${capitalize(next)} theme enabled`
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function saveInstructions() {
  if (
    !OZLIND.els.customInstructions
  ) {
    return;
  }

  OZLIND.state.customInstructions =
    OZLIND.els.customInstructions.value.trim();

  saveLocalData();

  showToast(
    "Custom instructions saved"
  );
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

const STORAGE_KEY =
  "ozlind_ai_state_v1";

function saveLocalData() {
  try {
    const data = {
      conversations:
        OZLIND.state.conversations,

      currentConversationId:
        OZLIND.state.currentConversationId,

      theme:
        OZLIND.state.theme,

      memoryEnabled:
        OZLIND.state.memoryEnabled,

      responseStyle:
        OZLIND.state.responseStyle,

      responseLength:
        OZLIND.state.responseLength,

      customInstructions:
        OZLIND.state.customInstructions,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(
      "OZLIND storage error:",
      error
    );
  }
}

function loadLocalData() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      createConversation();
      return;
    }

    const data =
      JSON.parse(raw);

    if (
      Array.isArray(
        data.conversations
      )
    ) {
      OZLIND.state.conversations =
        data.conversations;
    }

    if (
      typeof data.theme ===
      "string"
    ) {
      OZLIND.state.theme =
        data.theme;
    }

    if (
      typeof data.memoryEnabled ===
      "boolean"
    ) {
      OZLIND.state.memoryEnabled =
        data.memoryEnabled;
    }

    if (
      typeof data.responseStyle ===
      "string"
    ) {
      OZLIND.state.responseStyle =
        data.responseStyle;
    }

    if (
      typeof data.responseLength ===
      "string"
    ) {
      OZLIND.state.responseLength =
        data.responseLength;
    }

    if (
      typeof data.customInstructions ===
      "string"
    ) {
      OZLIND.state.customInstructions =
        data.customInstructions;
    }

    if (
      data.currentConversationId &&
      OZLIND.state.conversations.some(
        (conversation) =>
          conversation.id ===
          data.currentConversationId
      )
    ) {
      OZLIND.state.currentConversationId =
        data.currentConversationId;

      const current =
        OZLIND.state.conversations.find(
          (conversation) =>
            conversation.id ===
            data.currentConversationId
        );

      OZLIND.state.messages = [
        ...(current?.messages || []),
      ];
    } else if (
      OZLIND.state.conversations
        .length
    ) {
      const first =
        OZLIND.state.conversations[0];

      OZLIND.state.currentConversationId =
        first.id;

      OZLIND.state.messages = [
        ...(first.messages || []),
      ];
    } else {
      createConversation();
    }

    if (
      OZLIND.els.customInstructions
    ) {
      OZLIND.els.customInstructions.value =
        OZLIND.state.customInstructions;
    }

    if (
      OZLIND.els.memoryToggle
    ) {
      OZLIND.els.memoryToggle.checked =
        OZLIND.state.memoryEnabled;
    }

    if (
      OZLIND.els.responseStyle
    ) {
      OZLIND.els.responseStyle.value =
        OZLIND.state.responseStyle;
    }

    if (
      OZLIND.els.responseLength
    ) {
      OZLIND.els.responseLength.value =
        OZLIND.state.responseLength;
    }
  } catch (error) {
    console.warn(
      "OZLIND load error:",
      error
    );

    OZLIND.state.conversations =
      [];

    createConversation();
  }
}

function deleteLocalData() {
  const confirmed =
    window.confirm(
      "Delete all locally stored OZLIND conversations and settings?"
    );

  if (!confirmed) return;

  localStorage.removeItem(
    STORAGE_KEY
  );

  OZLIND.state.conversations =
    [];

  OZLIND.state.messages =
    [];

  OZLIND.state.currentConversationId =
    null;

  OZLIND.state.customInstructions =
    "";

  createConversation();

  if (
    OZLIND.els.customInstructions
  ) {
    OZLIND.els.customInstructions.value =
      "";
  }

  renderHistory();
  renderMessages();
  updateContextMeter();

  showToast(
    "Local data deleted"
  );
}

/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

function handleKeyboardShortcuts(
  event
) {
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

    OZLIND.els.searchInput?.focus();

    return;
  }

  if (
    modifier &&
    event.key.toLowerCase() ===
      "n"
  ) {
    event.preventDefault();

    startNewChat();

    return;
  }

  if (
    event.key === "Escape" &&
    OZLIND.state.generating
  ) {
    stopGeneration();
  }
}

/* =========================================================
   HELPERS
========================================================= */

function createMessageId() {
  return (
    "msg_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function autoResizeTextarea(
  textarea
) {
  if (!textarea) return;

  textarea.style.height =
    "auto";

  textarea.style.height =
    `${Math.min(
      textarea.scrollHeight,
      180
    )}px`;
}

function scrollChatToBottom() {
  const container =
    OZLIND.els.chatMessages;

  if (!container) return;

  requestAnimationFrame(() => {
    container.scrollTop =
      container.scrollHeight;
  });
}

function formatDate(
  timestamp
) {
  if (!timestamp) {
    return "";
  }

  const date =
    new Date(timestamp);

  const now =
    new Date();

  const diff =
    now.getTime() -
    date.getTime();

  if (
    diff <
    24 * 60 * 60 * 1000
  ) {
    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  return date.toLocaleDateString(
    [],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function capitalize(text) {
  return (
    String(text || "")
      .charAt(0)
      .toUpperCase() +
    String(text || "")
      .slice(1)
  );
}

function escapeHtml(text) {
  return String(text || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function escapeAttribute(
  text
) {
  return escapeHtml(text);
}

function showToast(message) {
  const toast =
    OZLIND.els.toast;

  if (!toast) return;

  toast.textContent =
    String(message || "");

  toast.classList.add(
    "show"
  );

  clearTimeout(
    showToast.timeout
  );

  showToast.timeout =
    setTimeout(() => {
      toast.classList.remove(
        "show"
      );
    }, 2400);
}

/* =========================================================
   PUBLIC API
========================================================= */

window.OZLIND = OZLIND;
