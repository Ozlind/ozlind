(() => {
  "use strict";

  const state = {
    messages: [],
    loading: false
  };

  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearChatBtn");
  const newChatBtn = document.getElementById("newChatBtn");
  const workspaceNewChat = document.getElementById("workspaceNewChat");
  const researchIndicator = document.getElementById("researchIndicator");

  const sidebar = document.getElementById("sidebar");
  const menuButton = document.getElementById("menuButton");
  const mobileClose = document.getElementById("mobileClose");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  const historyContainer = document.getElementById("historyContainer");
  const recentActivity = document.getElementById("recentActivity");
  const globalSearch = document.getElementById("globalSearch");

  const STORAGE_KEY = "ozlind_chat_history_v1";


  /* =========================================
     SAFE HTML
  ========================================= */

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }


  /* =========================================
     PAGE NAVIGATION
  ========================================= */

  function openPage(pageName) {
    const pages = document.querySelectorAll(".page");

    pages.forEach((page) => {
      page.classList.remove("active-page");
    });

    const target = document.getElementById(`page-${pageName}`);

    if (target) {
      target.classList.add("active-page");
    }

    document.querySelectorAll(".sidebar-item").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === pageName
      );
    });

    document.querySelectorAll(".mobile-nav-item").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === pageName
      );
    });

    closeMobileSidebar();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (pageName === "history") {
      renderHistory();
    }
  }


  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-page]");

    if (!trigger) {
      return;
    }

    const page = trigger.dataset.page;

    if (!page) {
      return;
    }

    openPage(page);

    if (trigger.dataset.researchFocus === "true") {
      setTimeout(() => {
        openPage("chat");

        input?.focus();
      }, 100);
    }
  });


  /* =========================================
     MOBILE SIDEBAR
  ========================================= */

  function openMobileSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
  }

  menuButton?.addEventListener("click", openMobileSidebar);
  mobileClose?.addEventListener("click", closeMobileSidebar);
  sidebarOverlay?.addEventListener("click", closeMobileSidebar);


  /* =========================================
     CHAT UI
  ========================================= */

  function showWelcome() {
    messagesEl.innerHTML = `
      <div class="welcome-message">

        <div class="welcome-logo">
          ✦
        </div>

        <h2>
          How can I help you?
        </h2>

        <p>
          Ask me anything. When you ask for current information,
          OZLIND can research the live web before answering.
        </p>

        <div class="suggestion-grid">

          <button data-prompt="Explain artificial intelligence simply">
            <span>✦</span>
            Explain AI simply
          </button>

          <button data-prompt="Write a Python program to sort a list">
            <span>&lt;/&gt;</span>
            Write Python code
          </button>

          <button data-prompt="What are the latest AI news today?">
            <span>⌕</span>
            Latest AI news
          </button>

          <button data-prompt="What is the current price of Bitcoin?">
            <span>◈</span>
            Current Bitcoin price
          </button>

        </div>

      </div>
    `;
  }


  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }


  function addMessage(role, content, sources = []) {
    const wrapper = document.createElement("div");

    wrapper.className = `message ${role}`;

    const avatar = role === "user"
      ? "A"
      : "✦";


    let sourcesHTML = "";

    if (
      role === "assistant" &&
      Array.isArray(sources) &&
      sources.length
    ) {
      sourcesHTML = `
        <div class="message-sources">

          <div class="sources-title">
            WEB SOURCES
          </div>

          ${sources.slice(0, 5).map((source) => {

            const title = escapeHTML(
              source.title ||
              source.url ||
              "Web source"
            );

            const url = escapeHTML(
              source.url || "#"
            );

            return `
              <a
                href="${url}"
                target="_blank"
                rel="noopener noreferrer"
                title="${title}"
              >
                ${title}
              </a>
            `;

          }).join("")}

        </div>
      `;
    }


    wrapper.innerHTML = `
      <div class="message-avatar">
        ${avatar}
      </div>

      <div class="message-body">

        <div class="message-content">
          ${escapeHTML(content)}
        </div>

        ${sourcesHTML}

      </div>
    `;


    messagesEl.appendChild(wrapper);

    scrollToBottom();
  }


  function showTyping() {
    const typing = document.createElement("div");

    typing.className = "message assistant";
    typing.id = "typingMessage";

    typing.innerHTML = `
      <div class="message-avatar">
        ✦
      </div>

      <div class="message-body">

        <div class="typing">
          <span></span>
          <span></span>
          <span></span>
        </div>

      </div>
    `;

    messagesEl.appendChild(typing);

    scrollToBottom();
  }


  function removeTyping() {
    document.getElementById("typingMessage")?.remove();
  }


  function setLoading(value) {
    state.loading = value;

    if (sendBtn) {
      sendBtn.disabled = value;
    }

    if (input) {
      input.disabled = value;
    }

    if (value) {
      researchIndicator?.classList.add("show");
    } else {
      researchIndicator?.classList.remove("show");
    }
  }


  /* =========================================
     SEND MESSAGE
  ========================================= */

  async function sendMessage(text) {
    const message = text.trim();

    if (!message || state.loading) {
      return;
    }

    if (message.length > 8000) {
      addMessage(
        "assistant",
        "Your message is too long. Please keep it under 8000 characters."
      );

      return;
    }


    state.messages.push({
      role: "user",
      content: message
    });


    if (messagesEl.querySelector(".welcome-message")) {
      messagesEl.innerHTML = "";
    }


    addMessage("user", message);

    input.value = "";
    input.style.height = "auto";

    showTyping();

    setLoading(true);


    try {

      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          messages: state.messages
        })
      });


      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Invalid server response."
        );
      }


      if (!response.ok) {
        throw new Error(
          data?.error ||
          "OZLIND could not process your request."
        );
      }


      const reply =
        typeof data.reply === "string" &&
        data.reply.trim()
          ? data.reply.trim()
          : "I couldn't generate a response.";


      state.messages.push({
        role: "assistant",
        content: reply
      });


      removeTyping();


      addMessage(
        "assistant",
        reply,
        Array.isArray(data.sources)
          ? data.sources
          : []
      );


      saveCurrentConversation();

    } catch (error) {

      removeTyping();

      addMessage(
        "assistant",
        error?.message ||
        "Something went wrong. Please try again."
      );

    } finally {

      setLoading(false);

      input.disabled = false;

      input.focus();
    }
  }


  /* =========================================
     FORM
  ========================================= */

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    sendMessage(input.value);
  });


  input?.addEventListener("keydown", (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      form.requestSubmit();
    }

  });


  input?.addEventListener("input", () => {

    input.style.height = "auto";

    input.style.height =
      `${Math.min(input.scrollHeight, 130)}px`;

  });


  /* =========================================
     SUGGESTIONS
  ========================================= */

  messagesEl?.addEventListener("click", (event) => {

    const button =
      event.target.closest("[data-prompt]");

    if (!button) {
      return;
    }

    const prompt =
      button.getAttribute("data-prompt");

    if (prompt) {
      sendMessage(prompt);
    }

  });


  /* =========================================
     CLEAR CHAT
  ========================================= */

  function clearChat() {

    if (state.loading) {
      return;
    }

    state.messages = [];

    showWelcome();

    input.value = "";
    input.style.height = "auto";

    saveCurrentConversation();

    input.focus();
  }


  clearBtn?.addEventListener(
    "click",
    clearChat
  );

  newChatBtn?.addEventListener(
    "click",
    () => {
      openPage("chat");
      clearChat();
    }
  );

  workspaceNewChat?.addEventListener(
    "click",
    clearChat
  );


  /* =========================================
     LOCAL HISTORY
  ========================================= */

  function getHistory() {

    try {

      const stored =
        localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return [];
      }

      const parsed =
        JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch {
      return [];
    }
  }


  function saveCurrentConversation() {

    if (!state.messages.length) {
      return;
    }

    const firstUser =
      state.messages.find(
        (item) => item.role === "user"
      );

    if (!firstUser) {
      return;
    }


    const history = getHistory();

    const item = {
      id: Date.now(),
      title: firstUser.content.slice(0, 70),
      messages: state.messages.slice(-20),
      createdAt: new Date().toISOString()
    };


    history.unshift(item);

    const limited =
      history.slice(0, 30);


    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(limited)
      );
    } catch {
      // Ignore storage errors.
    }


    renderRecentActivity();
  }


  function renderRecentActivity() {

    if (!recentActivity) {
      return;
    }

    const history = getHistory();

    if (!history.length) {

      recentActivity.innerHTML = `
        <div class="empty-activity">

          <div>◷</div>

          <p>
            Your recent chats will appear here.
          </p>

        </div>
      `;

      return;
    }


    recentActivity.innerHTML =
      history
        .slice(0, 5)
        .map((item) => `
          <div class="activity-item">

            <div class="activity-icon">
              ✦
            </div>

            <div class="activity-text">

              <strong>
                ${escapeHTML(item.title)}
              </strong>

              <span>
                ${formatDate(item.createdAt)}
              </span>

            </div>

            <span class="activity-arrow">
              →
            </span>

          </div>
        `)
        .join("");
  }


  function renderHistory() {

    if (!historyContainer) {
      return;
    }

    const history = getHistory();


    if (!history.length) {

      historyContainer.innerHTML = `
        <div class="history-empty">

          <div class="history-empty-icon">
            ◷
          </div>

          <h2>
            No conversations yet
          </h2>

          <p>
            Start chatting with OZLIND and your recent
            conversations will appear here.
          </p>

        </div>
      `;

      return;
    }


    historyContainer.innerHTML =
      history
        .map((item) => `
          <button
            class="history-item"
            data-history-id="${item.id}"
          >

            <div class="history-item-icon">
              ✦
            </div>

            <div class="history-item-content">

              <strong>
                ${escapeHTML(item.title)}
              </strong>

              <span>
                ${formatDate(item.createdAt)}
              </span>

            </div>

            <span class="history-item-arrow">
              →
            </span>

          </button>
        `)
        .join("");
  }


  function formatDate(dateString) {

    try {

      return new Intl.DateTimeFormat(
        undefined,
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      ).format(new Date(dateString));

    } catch {
      return "Recent";
    }
  }


  historyContainer?.addEventListener(
    "click",
    (event) => {

      const item =
        event.target.closest(
          "[data-history-id]"
        );

      if (!item) {
        return;
      }

      const id =
        Number(
          item.dataset.historyId
        );

      const history =
        getHistory();

      const selected =
        history.find(
          (entry) => entry.id === id
        );

      if (!selected) {
        return;
      }


      state.messages =
        Array.isArray(selected.messages)
          ? selected.messages
          : [];


      openPage("chat");

      messagesEl.innerHTML = "";


      state.messages.forEach((message) => {

        addMessage(
          message.role,
          message.content
        );

      });


      scrollToBottom();

      input.focus();
    }
  );


  document
    .getElementById("clearHistoryBtn")
    ?.addEventListener(
      "click",
      () => {

        localStorage.removeItem(
          STORAGE_KEY
        );

        renderHistory();
        renderRecentActivity();

      }
    );


  /* =========================================
     GLOBAL SEARCH
  ========================================= */

  globalSearch?.addEventListener(
    "keydown",
    (event) => {

      if (event.key !== "Enter") {
        return;
      }

      const query =
        globalSearch.value.trim();

      if (!query) {
        return;
      }

      openPage("chat");

      input.value = query;

      input.focus();

      form.requestSubmit();

      globalSearch.value = "";
    }
  );


  /* =========================================
     KEYBOARD SHORTCUT
  ========================================= */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "/" &&
        document.activeElement !== input &&
        document.activeElement !== globalSearch
      ) {
        event.preventDefault();

        globalSearch?.focus();
      }

      if (
        event.key === "Escape" &&
        window.innerWidth <= 850
      ) {
        closeMobileSidebar();
      }

    }
  );


  /* =========================================
     INITIALIZE
  ========================================= */

  renderRecentActivity();

  renderHistory();

  showWelcome();

})();
