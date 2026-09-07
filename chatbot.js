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
  const researchIndicator = document.getElementById("researchIndicator");
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const searchInput = document.getElementById("featureSearch");

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  function showWelcome() {
    messagesEl.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">✦</div>

        <h2>How can I help you?</h2>

        <p>
          Ask me anything. For current information, OZLIND can
          research the web before answering.
        </p>

        <div class="suggestions">
          <button data-prompt="Explain artificial intelligence simply">
            Explain AI simply
          </button>

          <button data-prompt="Write a Python program to sort a list">
            Write Python code
          </button>

          <button data-prompt="What are the latest AI news today?">
            Latest AI news
          </button>

          <button data-prompt="What is the current price of Bitcoin?">
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

    const avatar = role === "user" ? "A" : "✦";

    let sourcesHTML = "";

    if (
      role === "assistant" &&
      Array.isArray(sources) &&
      sources.length > 0
    ) {
      sourcesHTML = `
        <div class="message-sources">
          <div class="sources-title">WEB SOURCES</div>
          ${sources
            .slice(0, 5)
            .map(
              (source) => `
                <a
                  href="${escapeHTML(source.url || "#")}"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="${escapeHTML(source.title || "Source")}"
                >
                  ${escapeHTML(source.title || source.url || "Source")}
                </a>
              `
            )
            .join("")}
        </div>
      `;
    }

    wrapper.innerHTML = `
      <div class="message-avatar">${avatar}</div>

      <div class="message-body">
        <div class="message-content">${escapeHTML(content)}</div>
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
      <div class="message-avatar">✦</div>
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

    sendBtn.disabled = value;
    input.disabled = value;

    if (value) {
      researchIndicator.classList.add("show");
    } else {
      researchIndicator.classList.remove("show");
    }
  }

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
        throw new Error("Invalid server response.");
      }

      if (!response.ok) {
        throw new Error(
          data?.error || "OZLIND could not process your request."
        );
      }

      const reply =
        typeof data.reply === "string" && data.reply.trim()
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
        Array.isArray(data.sources) ? data.sources : []
      );
    } catch (error) {
      removeTyping();

      const safeMessage =
        error?.message ||
        "Something went wrong. Please try again.";

      addMessage("assistant", safeMessage);
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  function clearChat() {
    state.messages = [];
    showWelcome();
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
  });

  clearBtn.addEventListener("click", clearChat);
  newChatBtn.addEventListener("click", clearChat);

  messagesEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");

    if (!button) {
      return;
    }

    const prompt = button.getAttribute("data-prompt");

    if (prompt) {
      sendMessage(prompt);
    }
  });

  menuBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      const nav = item.dataset.nav;

      if (nav === "chat" || nav === "home") {
        document.getElementById("chatPanel")?.scrollIntoView({
          behavior: "smooth"
        });
      }

      if (nav === "research") {
        input.focus();
        input.value = "Search the web for ";
      }

      if (window.innerWidth <= 950) {
        sidebar.classList.remove("open");
      }
    });
  });

  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("click", () => {
      const feature = card.dataset.feature;

      if (feature === "chat") {
        document.getElementById("chatPanel")?.scrollIntoView({
          behavior: "smooth"
        });
        input.focus();
        return;
      }

      if (feature === "research") {
        document.getElementById("chatPanel")?.scrollIntoView({
          behavior: "smooth"
        });

        input.focus();
        input.value = "Search the web for ";
        return;
      }

      addMessage(
        "assistant",
        `${card.querySelector("h3")?.textContent || "This feature"} is coming next in OZLIND.`
      );
    });
  });

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    document.querySelectorAll(".feature-card").forEach((card) => {
      const text = card.textContent.toLowerCase();

      card.style.display =
        !query || text.includes(query)
          ? ""
          : "none";
    });
  });

  showWelcome();
})();
