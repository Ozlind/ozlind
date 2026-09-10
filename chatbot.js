(() => {
  "use strict";

  /*
   * ============================================================
   * OZLIND AI — Chat Client
   * Phase 1B
   * ============================================================
   */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const STORAGE = {
    chats: "ozlind_chats_v3",
    settings: "ozlind_settings_v3",
    theme: "ozlind_theme_v3"
  };

  let chats = load(STORAGE.chats, []);
  let active = chats[0]?.id || null;

  let attachments = [];
  let controller = null;
  let busy = false;

  let settings = {
    length: "medium",
    style: "balanced",
    memory: true,
    instructions: "",
    ...load(STORAGE.settings, {})
  };

  /*
   * ------------------------------------------------------------
   * Storage
   * ------------------------------------------------------------
   */

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);

      if (value === null) {
        return fallback;
      }

      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Browser storage is full.", "error");
    }
  }

  function persist() {
    chats = chats
      .filter(chat => chat && chat.id && Array.isArray(chat.messages))
      .slice(0, 100);

    save(STORAGE.chats, chats);
  }

  /*
   * ------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------
   */

  function uid() {
    return (
      crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
    );
  }

  function cleanTitle(text) {
    const value = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
      .trim();

    if (!value) {
      return "New chat";
    }

    /*
     * Common conversational openings are not useful titles.
     */

    const cleaned = value
      .replace(
        /^(hi|hello|hey|hai|good morning|good afternoon|good evening)[,!.\s]*/i,
        ""
      )
      .trim();

    if (!cleaned) {
      return "New conversation";
    }

    /*
     * Remove common question filler.
     */

    const title = cleaned
      .replace(
        /^(can you|could you|please|help me|i want to|i need to)\s+/i,
        ""
      )
      .trim();

    if (!title) {
      return "New conversation";
    }

    /*
     * Keep history compact.
     */

    const result =
      title.charAt(0).toUpperCase() +
      title.slice(1);

    return result.length > 58
      ? `${result.slice(0, 58).trim()}…`
      : result;
  }

  function toast(message, type = "") {
    const stack = $("#toastStack");

    if (!stack) {
      return;
    }

    const node = document.createElement("div");

    node.className = `toast ${type}`;
    node.textContent = message;

    stack.append(node);

    setTimeout(() => {
      node.remove();
    }, 3000);
  }

  function currentChat() {
    return chats.find(chat => chat.id === active);
  }

  /*
   * ------------------------------------------------------------
   * Chat lifecycle
   * ------------------------------------------------------------
   */

  function newChat() {
    const chat = {
      id: uid(),
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    chats.unshift(chat);

    active = chat.id;

    persist();
    render();

    openPage("chat");

    requestAnimationFrame(() => {
      $("#chatInput")?.focus();
    });
  }

  function openPage(view) {
    $$(".page").forEach(page => {
      page.classList.toggle(
        "active",
        page.dataset.page === view
      );
    });

    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

    const titles = {
      chat: "Chat",
      history: "History",
      research: "Research",
      vision: "Vision",
      settings: "Settings"
    };

    const topbar = $("#topbarTitle");

    if (topbar) {
      topbar.textContent = titles[view] || "OZLIND";
    }

    if (view === "history") {
      renderHistory();
    }

    if (view === "settings") {
      renderSettings();
    }

    $("#sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("open");
  }

  /*
   * ------------------------------------------------------------
   * Input sizing
   * ------------------------------------------------------------
   */

  function resizeInput() {
    const input = $("#chatInput");

    if (!input) {
      return;
    }

    input.style.height = "auto";

    input.style.height =
      `${Math.min(input.scrollHeight, 170)}px`;
  }

  /*
   * ------------------------------------------------------------
   * Chat rendering
   * ------------------------------------------------------------
   */

  function render() {
    const chat = currentChat();

    const box = $("#chatMessages");
    const empty = $("#chatEmpty");

    if (!box || !empty) {
      return;
    }

    box.innerHTML = "";

    if (!chat || !chat.messages.length) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    chat.messages.forEach((message, index) => {
      const article = document.createElement("article");

      article.className =
        `message ${message.role}` +
        (message.error ? " error" : "");

      const roleName =
        message.role === "user"
          ? "You"
          : "OZLIND AI";

      const body = escapeHTML(message.content)
        .replace(/\n/g, "<br>");

      article.innerHTML = `
        <div class="meta">
          ${roleName}
        </div>

        <div class="body">
          ${body}
        </div>

        ${
          message.role === "assistant" && !message.error
            ? `
              <div class="message-tools">
                <button
                  type="button"
                  data-copy="${index}"
                >
                  Copy
                </button>
              </div>
            `
            : ""
        }
      `;

      box.append(article);
    });

    const scroll = $("#chatScroll");

    if (scroll) {
      requestAnimationFrame(() => {
        scroll.scrollTop = scroll.scrollHeight;
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * History
   * ------------------------------------------------------------
   */

  function renderHistory(filter = "") {
    const list = $("#conversationList");

    if (!list) {
      return;
    }

    const query = String(filter)
      .toLowerCase()
      .trim();

    list.innerHTML = "";

    const filtered = chats.filter(chat => {
      const searchable =
        `${chat.title} ${
          chat.messages
            .map(message => message.content)
            .join(" ")
        }`.toLowerCase();

      return searchable.includes(query);
    });

    if (!filtered.length) {
      list.innerHTML = `
        <div class="history-empty">
          <b>No conversations</b>
          <small>Your saved conversations will appear here.</small>
        </div>
      `;

      return;
    }

    filtered.forEach(chat => {
      const item = document.createElement("div");

      item.className = "history-item";

      item.innerHTML = `
        <div class="history-main">
          <b>${escapeHTML(chat.title)}</b>
          <small>
            ${chat.messages.length}
            message${chat.messages.length === 1 ? "" : "s"}
          </small>
        </div>

        <button
          type="button"
          data-open="${escapeHTML(chat.id)}"
          aria-label="Open conversation"
        >
          →
        </button>

        <button
          type="button"
          data-delete="${escapeHTML(chat.id)}"
          aria-label="Delete conversation"
        >
          ×
        </button>
      `;

      list.append(item);
    });
  }

  /*
   * ------------------------------------------------------------
   * Settings
   * ------------------------------------------------------------
   */

  function renderSettings() {
    const length = $("#responseLength");
    const style = $("#responseStyle");
    const instructions = $("#customInstructions");
    const memory = $("#memoryToggle");

    if (length) {
      length.value = settings.length;
    }

    if (style) {
      style.value = settings.style;
    }

    if (instructions) {
      instructions.value = settings.instructions || "";
    }

    if (memory) {
      memory.setAttribute(
        "aria-pressed",
        String(Boolean(settings.memory))
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Attachments / Vision
   * ------------------------------------------------------------
   */

  function renderAttachments() {
    const container = $("#chatAttachments");
    const indicator = $("#contextIndicator");

    if (!container) {
      return;
    }

    container.innerHTML = attachments
      .map(
        (file, index) => `
          <div class="attachment">
            <img
              src="${escapeHTML(file.dataUrl)}"
              alt=""
            >

            <button
              type="button"
              data-remove="${index}"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        `
      )
      .join("");

    if (indicator) {
      indicator.textContent =
        attachments.length
          ? `${attachments.length} image${
              attachments.length > 1 ? "s" : ""
            } attached`
          : "Ready";
    }
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const available =
      Math.max(0, 4 - attachments.length);

    const imageFiles = [...fileList]
      .filter(file => file.type.startsWith("image/"))
      .slice(0, available);

    for (const file of imageFiles) {
      /*
       * Keep client-side payload reasonable.
       */

      if (file.size > 8 * 1024 * 1024) {
        toast(
          "Each image must be under 8 MB.",
          "error"
        );

        continue;
      }

      attachments.push({
        name: file.name,
        type: file.type,
        dataUrl: await readImage(file)
      });
    }

    renderAttachments();
  }

  /*
   * ------------------------------------------------------------
   * API message preparation
   * ------------------------------------------------------------
   */

  function requestMessages(chat) {
    if (!chat) {
      return [];
    }

    const source = settings.memory
      ? chat.messages.slice(-20)
      : chat.messages.slice(-1);

    return source.map(message => {
      if (
        message.role === "user" &&
        message.attachments?.length
      ) {
        return {
          role: "user",

          content: [
            {
              type: "text",
              text: message.content || ""
            },

            ...message.attachments.map(image => ({
              type: "image_url",
              image_url: {
                url: image.dataUrl
              }
            }))
          ]
        };
      }

      return {
        role: message.role,
        content: message.content
      };
    });
  }

  /*
   * ------------------------------------------------------------
   * Send message
   * ------------------------------------------------------------
   */

  async function send() {
    if (busy) {
      return;
    }

    const input = $("#chatInput");

    if (!input) {
      return;
    }

    const text = input.value.trim();

    if (!text && !attachments.length) {
      return;
    }

    let chat = currentChat();

    if (!chat) {
      newChat();
      chat = currentChat();
    }

    if (!chat) {
      toast("Unable to create a conversation.", "error");
      return;
    }

    const images = attachments.splice(0, 4);

    renderAttachments();

    chat.messages.push({
      role: "user",
      content: text,
      attachments: images
    });

    /*
     * Generate a meaningful local title from the
     * user's first message without making another API call.
     */

    if (chat.messages.length === 1) {
      chat.title = cleanTitle(
        text || "Image analysis"
      );
    }

    chat.updatedAt = new Date().toISOString();

    persist();

    input.value = "";

    resizeInput();

    render();

    const assistant = {
      role: "assistant",
      content: ""
    };

    chat.messages.push(assistant);

    busy = true;

    controller = new AbortController();

    $("#sendBtn")?.classList.add("hidden");
    $("#stopBtn")?.classList.remove("hidden");

    const status = $("#connectionStatus");

    if (status) {
      status.innerHTML = "<i></i> Thinking…";
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        signal: controller.signal,

        body: JSON.stringify({
          messages: requestMessages(chat),

          model:
            $("#modelSelect")?.value || "auto",

          research:
            $("#researchToggle")
              ?.getAttribute("aria-pressed") === "true",

          responseLength: settings.length,

          responseStyle: settings.style,

          memory: settings.memory,

          customInstructions:
            settings.instructions
        })
      });

      if (!response.ok) {
        let message =
          `Request failed (${response.status}).`;

        try {
          const data = await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {
          /* Keep default error */
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "No response returned from OZLIND."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const result = await reader.read();

        if (result.done) {
          break;
        }

        buffer += decoder.decode(
          result.value,
          { stream: true }
        );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }

          const raw =
            line.slice(5).trim();

          if (!raw || raw === "[DONE]") {
            continue;
          }

          let data;

          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }

          if (data.type === "delta") {
            assistant.content +=
              data.content || "";

            render();
          }

          if (data.type === "error") {
            throw new Error(
              data.error || "Generation failed."
            );
          }
        }
      }

      if (!assistant.content.trim()) {
        throw new Error(
          "OZLIND returned an empty response."
        );
      }

    } catch (error) {

      if (error?.name === "AbortError") {
        assistant.content =
          "Generation stopped.";
      } else {
        assistant.error = true;

        assistant.content =
          error?.message ||
          "Unable to complete the request.";

        toast(
          assistant.content,
          "error"
        );
      }

    } finally {

      chat.updatedAt =
        new Date().toISOString();

      persist();

      render();

      busy = false;
      controller = null;

      $("#sendBtn")?.classList.remove("hidden");
      $("#stopBtn")?.classList.add("hidden");

      if (status) {
        status.innerHTML =
          "<i></i> Ready";
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * Theme
   * ------------------------------------------------------------
   */

  function toggleTheme() {
    const current =
      document.body.dataset.theme === "dark"
        ? "dark"
        : "light";

    const next =
      current === "dark"
        ? "light"
        : "dark";

    document.body.dataset.theme = next;

    save(STORAGE.theme, next);

    const button = $("#themeToggle");

    if (button) {
      button.textContent =
        next === "dark"
          ? "☾"
          : "☀";
    }
  }

  /*
   * ------------------------------------------------------------
   * Copy
   * ------------------------------------------------------------
   */

  async function copyMessage(index) {
    const chat = currentChat();

    const message =
      chat?.messages?.[index];

    if (
      !message ||
      message.role !== "assistant"
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        message.content || ""
      );

      toast("Copied", "ok");

    } catch {
      toast(
        "Copy unavailable.",
        "error"
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Events
   * ------------------------------------------------------------
   */

  document.addEventListener("click", event => {

    /*
     * Navigation
     */

    const navigation =
      event.target.closest("[data-view]");

    if (navigation) {
      openPage(
        navigation.dataset.view
      );

      return;
    }

    /*
     * Suggested prompts
     */

    const prompt =
      event.target.closest("[data-prompt]");

    if (prompt) {
      openPage("chat");

      const input = $("#chatInput");

      if (input) {
        input.value =
          prompt.dataset.prompt || "";

        resizeInput();
        input.focus();
      }

      return;
    }

    /*
     * New chat
     */

    if (
      event.target.closest("#newChatBtn")
    ) {
      newChat();
      return;
    }

    /*
     * Theme
     */

    if (
      event.target.closest("#themeToggle")
    ) {
      toggleTheme();
      return;
    }

    /*
     * Mobile sidebar
     */

    if (
      event.target.closest("#mobileNavBtn")
    ) {
      $("#sidebar")?.classList.add("open");
      $("#sidebarOverlay")?.classList.add("open");
      return;
    }

    if (
      event.target.closest("#sidebarOverlay")
    ) {
      $("#sidebar")?.classList.remove("open");
      $("#sidebarOverlay")?.classList.remove("open");
      return;
    }

    /*
     * Attach image
     */

    if (
      event.target.closest("#attachBtn")
    ) {
      $("#fileInput")?.click();
      return;
    }

    /*
     * Stop generation
     */

    if (
      event.target.closest("#stopBtn")
    ) {
      controller?.abort();
      return;
    }

    /*
     * Open chat from feature pages
     */

    if (
      event.target.closest("[data-go-chat]")
    ) {
      openPage("chat");
      return;
    }

    /*
     * Research toggle
     */

    if (
      event.target.closest("#researchToggle")
    ) {
      const button =
        $("#researchToggle");

      if (!button) {
        return;
      }

      const enabled =
        button.getAttribute("aria-pressed") ===
        "true";

      const next = !enabled;

      button.setAttribute(
        "aria-pressed",
        String(next)
      );

      const label =
        button.querySelector("em");

      if (label) {
        label.textContent =
          next ? "ON" : "OFF";
      }

      return;
    }

    /*
     * Remove attachment
     */

    const remove =
      event.target.closest("[data-remove]");

    if (remove) {
      const index =
        Number(remove.dataset.remove);

      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < attachments.length
      ) {
        attachments.splice(index, 1);
        renderAttachments();
      }

      return;
    }

    /*
     * Open history item
     */

    const openHistory =
      event.target.closest("[data-open]");

    if (openHistory) {
      active =
        openHistory.dataset.open;

      render();

      openPage("chat");

      return;
    }

    /*
     * Delete history item
     */

    const deleteHistory =
      event.target.closest("[data-delete]");

    if (deleteHistory) {

      const id =
        deleteHistory.dataset.delete;

      if (
        confirm(
          "Delete this conversation?"
        )
      ) {
        chats =
          chats.filter(
            chat => chat.id !== id
          );

        if (active === id) {
          active =
            chats[0]?.id || null;
        }

        persist();

        renderHistory();
        render();

        toast(
          "Conversation deleted.",
          "ok"
        );
      }

      return;
    }

    /*
     * Copy assistant response
     */

    const copy =
      event.target.closest("[data-copy]");

    if (copy) {
      copyMessage(
        Number(copy.dataset.copy)
      );

      return;
    }

    /*
     * Memory toggle
     */

    if (
      event.target.closest("#memoryToggle")
    ) {
      settings.memory =
        !settings.memory;

      save(
        STORAGE.settings,
        settings
      );

      renderSettings();

      return;
    }

    /*
     * Save settings
     */

    if (
      event.target.closest(
        "#saveInstructionsBtn"
      )
    ) {
      settings.length =
        $("#responseLength")?.value ||
        "medium";

      settings.style =
        $("#responseStyle")?.value ||
        "balanced";

      settings.instructions =
        (
          $("#customInstructions")?.value ||
          ""
        ).slice(0, 5000);

      save(
        STORAGE.settings,
        settings
      );

      toast(
        "Settings saved.",
        "ok"
      );

      return;
    }

    /*
     * Export history
     */

    if (
      event.target.closest("#exportHistoryBtn")
    ) {
      try {
        const blob = new Blob(
          [
            JSON.stringify(
              chats,
              null,
              2
            )
          ],
          {
            type: "application/json"
          }
        );

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download =
          "ozlind-history.json";

        document.body.append(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

      } catch {
        toast(
          "Unable to export history.",
          "error"
        );
      }

      return;
    }

    /*
     * Import history
     */

    if (
      event.target.closest("#importHistoryBtn")
    ) {
      $("#historyFileInput")?.click();
      return;
    }

    /*
     * Clear history
     */

    if (
      event.target.closest("#clearHistoryBtn")
    ) {
      if (
        confirm(
          "Clear all local history?"
        )
      ) {
        chats = [];
        active = null;

        persist();

        renderHistory();
        render();

        toast(
          "History cleared.",
          "ok"
        );
      }

      return;
    }
  });

  /*
   * ------------------------------------------------------------
   * Form / keyboard events
   * ------------------------------------------------------------
   */

  $("#chatForm")?.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      send();
    }
  );

  $("#chatInput")?.addEventListener(
    "input",
    resizeInput
  );

  $("#chatInput")?.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        send();
      }
    }
  );

  /*
   * Image input
   */

  $("#fileInput")?.addEventListener(
    "change",
    event => {

      if (event.target.files?.length) {
        addFiles(
          event.target.files
        );
      }

      event.target.value = "";
    }
  );

  /*
   * History search
   */

  $("#conversationSearch")?.addEventListener(
    "input",
    event => {
      renderHistory(
        event.target.value
      );
    }
  );

  /*
   * History import
   */

  $("#historyFileInput")?.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader =
        new FileReader();

      reader.onload = () => {

        try {

          const imported =
            JSON.parse(
              reader.result
            );

          if (!Array.isArray(imported)) {
            throw new Error(
              "Invalid history"
            );
          }

          chats =
            imported
              .filter(
                chat =>
                  chat?.id &&
                  Array.isArray(
                    chat.messages
                  )
              )
              .slice(0, 100);

          active =
            chats[0]?.id || null;

          persist();

          renderHistory();
          render();

          toast(
            "History imported.",
            "ok"
          );

        } catch {
          toast(
            "Invalid history file.",
            "error"
          );
        }
      };

      reader.readAsText(file);

      event.target.value = "";
    }
  );

  /*
   * ------------------------------------------------------------
   * Initialisation
   * ------------------------------------------------------------
   */

  window.addEventListener(
    "load",
    () => {

      const savedTheme =
        load(
          STORAGE.theme,
          "dark"
        );

      document.body.dataset.theme =
        savedTheme === "light"
          ? "light"
          : "dark";

      const themeButton =
        $("#themeToggle");

      if (themeButton) {
        themeButton.textContent =
          document.body.dataset.theme === "dark"
            ? "☾"
            : "☀";
      }

      if (!chats.length) {
        newChat();
      } else {
        render();
      }

      renderSettings();
      renderAttachments();
      resizeInput();
    }
  );

})();
