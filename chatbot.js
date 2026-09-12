/* =========================================================
   OZLIND AI — Chat Controller
   SVG-first UI actions
   Local conversation history
   Streaming responses
   Research toggle
   Image attachments
   Settings persistence
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------------------------------------
     DOM HELPERS
     ------------------------------------------------------- */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const icon = (name, className = "ui-icon") =>
    `<svg class="${className}" aria-hidden="true">
      <use href="#${name}"></use>
    </svg>`;

  /* -------------------------------------------------------
     STORAGE
     ------------------------------------------------------- */

  const K = {
    chats: "ozlind:v2:chats",
    settings: "ozlind:v2:settings",
    theme: "ozlind:v2:theme"
  };

  /* -------------------------------------------------------
     STATE
     ------------------------------------------------------- */

  let chats = load(K.chats, []);
  let active = chats[0]?.id || null;

  let files = [];
  let controller = null;
  let generating = false;

  let settings = {
    responseLength: "medium",
    responseStyle: "balanced",
    memory: true,
    instructions: "",
    ...load(K.settings, {})
  };

  /* -------------------------------------------------------
     STORAGE HELPERS
     ------------------------------------------------------- */

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Local storage is full", "error");
    }
  }

  function makeId() {
    try {
      return crypto.randomUUID();
    } catch {
      return Date.now() + "_" + Math.random().toString(36).slice(2);
    }
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

  /* -------------------------------------------------------
     TOAST
     ------------------------------------------------------- */

  function toast(message, type = "") {
    const stack = $("#toastStack");

    if (!stack) return;

    const item = document.createElement("div");

    item.className = `toast ${type}`;
    item.textContent = message;

    stack.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 3200);
  }

  /* -------------------------------------------------------
     CHAT HELPERS
     ------------------------------------------------------- */

  function current() {
    return chats.find(chat => chat.id === active);
  }

  function persist() {
    chats.sort(
      (a, b) =>
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
    );

    chats = chats.slice(0, 100);

    save(K.chats, chats);
  }

  function newChat() {
    const now = new Date().toISOString();

    const chat = {
      id: makeId(),
      title: "New chat",
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    chats.unshift(chat);

    active = chat.id;

    persist();
    renderMessages();
    renderHistory();

    showView("chat");

    setTimeout(() => {
      $("#chatInput")?.focus();
    }, 50);
  }

  function ensureChat() {
    if (!current()) {
      newChat();
    }

    return current();
  }

  /* -------------------------------------------------------
     VIEW NAVIGATION
     ------------------------------------------------------- */

  function showView(view) {
    $$(".page").forEach(page => {
      page.classList.toggle(
        "active",
        page.dataset.page === view
      );
    });

    $$(".nav-item").forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.view === view
      );
    });

    const titles = {
      chat: "AI Chat",
      history: "History",
      research: "Research",
      vision: "Vision",
      settings: "Settings"
    };

    const title = $("#topbarTitle");

    if (title) {
      title.textContent =
        titles[view] || "OZLIND";
    }

    if (view === "history") {
      renderHistory();
    }

    if (view === "settings") {
      loadSettingsUI();
    }

    $(".sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("open");
  }

  /* -------------------------------------------------------
     MESSAGE RENDERING
     ------------------------------------------------------- */

  function renderMessages() {
    const box = $("#chatMessages");
    const empty = $("#chatEmpty");
    const chat = current();

    if (!box || !empty) return;

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

      const label =
        message.role === "user"
          ? "You"
          : "OZLIND AI";

      let actions = "";

      if (!message.error && message.role === "assistant") {
        actions = `
          <div class="message-actions">
            <button
              type="button"
              data-copy="${index}"
              title="Copy response"
              aria-label="Copy response">
              ${icon("i-copy", "ui-icon tiny")}
              <span>Copy</span>
            </button>

            <button
              type="button"
              data-regenerate="${index}"
              title="Regenerate response"
              aria-label="Regenerate response">
              ${icon("i-regenerate", "ui-icon tiny")}
              <span>Regenerate</span>
            </button>

            <button
              type="button"
              data-delete-message="${index}"
              title="Delete response"
              aria-label="Delete response">
              ${icon("i-delete", "ui-icon tiny")}
              <span>Delete</span>
            </button>
          </div>
        `;
      }

      if (message.role === "user") {
        actions = `
          <div class="message-actions">
            <button
              type="button"
              data-edit="${index}"
              title="Edit message"
              aria-label="Edit message">
              ${icon("i-edit", "ui-icon tiny")}
              <span>Edit</span>
            </button>

            <button
              type="button"
              data-delete-message="${index}"
              title="Delete message"
              aria-label="Delete message">
              ${icon("i-delete", "ui-icon tiny")}
              <span>Delete</span>
            </button>
          </div>
        `;
      }

      article.innerHTML = `
        <div class="message-meta">
          ${escapeHTML(label)}
        </div>

        <div class="message-body">
          ${escapeHTML(message.content)}
        </div>

        ${actions}
      `;

      box.appendChild(article);
    });

    box.scrollTop = box.scrollHeight;
  }

  /* -------------------------------------------------------
     HISTORY
     ------------------------------------------------------- */

  function renderHistory(filter = "") {
    const box = $("#conversationList");

    if (!box) return;

    box.innerHTML = "";

    const query = filter
      .trim()
      .toLowerCase();

    const filtered = chats.filter(chat => {
      const searchable =
        `${chat.title} ${chat.messages
          .map(message => message.content)
          .join(" ")}`
          .toLowerCase();

      return searchable.includes(query);
    });

    if (!filtered.length) {
      box.innerHTML = `
        <div class="history-empty">
          <div class="empty-icon">
            ${icon("i-history")}
          </div>
          <p>No conversations found.</p>
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
            ${chat.messages.length === 1 ? "message" : "messages"}
          </small>
        </div>

        <button
          class="icon-btn"
          type="button"
          data-open="${chat.id}"
          title="Open conversation"
          aria-label="Open conversation">
          ${icon("i-forward", "ui-icon small")}
        </button>

        <button
          class="icon-btn"
          type="button"
          data-delete="${chat.id}"
          title="Delete conversation"
          aria-label="Delete conversation">
          ${icon("i-delete", "ui-icon small")}
        </button>
      `;

      box.appendChild(item);
    });
  }

  /* -------------------------------------------------------
     CHAT TITLE
     ------------------------------------------------------- */

  function titleFrom(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      return "New chat";
    }

    return clean.length > 70
      ? clean.slice(0, 67) + "..."
      : clean;
  }

  /* -------------------------------------------------------
     INPUT
     ------------------------------------------------------- */

  function resizeInput() {
    const input = $("#chatInput");

    if (!input) return;

    input.style.height = "auto";

    input.style.height =
      Math.min(input.scrollHeight, 180) + "px";
  }

  /* -------------------------------------------------------
     FILES
     ------------------------------------------------------- */

  function renderFiles() {
    const box = $("#chatAttachments");

    if (!box) return;

    box.innerHTML = "";

    files.forEach((file, index) => {
      const item = document.createElement("div");

      item.className = "attachment";

      item.innerHTML = `
        <img
          src="${escapeHTML(file.dataUrl)}"
          alt="${escapeHTML(file.name || "Attachment")}">

        <button
          type="button"
          data-file="${index}"
          title="Remove attachment"
          aria-label="Remove attachment">
          ${icon("i-close", "ui-icon tiny")}
        </button>
      `;

      box.appendChild(item);
    });

    const indicator = $("#contextIndicator");

    if (indicator) {
      indicator.textContent =
        files.length
          ? `${files.length} attachment${files.length === 1 ? "" : "s"}`
          : "";
    }
  }

  function dataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () =>
        resolve(reader.result);

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  async function addFiles(list) {
    const selected = [...list];

    for (
      const file of selected.slice(
        0,
        4 - files.length
      )
    ) {
      if (
        !file.type.startsWith("image/") ||
        file.size > 8 * 1024 * 1024
      ) {
        toast(
          "Only images up to 8MB are supported",
          "error"
        );

        continue;
      }

      try {
        files.push({
          name: file.name,
          type: file.type,
          dataUrl: await dataURL(file)
        });
      } catch {
        toast(
          `Could not read ${file.name}`,
          "error"
        );
      }
    }

    renderFiles();
  }

  /* -------------------------------------------------------
     API MESSAGE PAYLOAD
     ------------------------------------------------------- */

  function payloadMessages(chat) {
    const history = settings.memory
      ? chat.messages.slice(-20)
      : chat.messages.slice(-1);

    return history.map(message => {
      if (
        message.role === "user" &&
        message.attachments?.length
      ) {
        return {
          role: "user",
          content: [
            {
              type: "text",
              text: message.content
            },

            ...message.attachments.map(
              attachment => ({
                type: "image_url",
                image_url: {
                  url: attachment.dataUrl
                }
              })
            )
          ]
        };
      }

      return {
        role: message.role,
        content: message.content
      };
    });
  }

  /* -------------------------------------------------------
     SEND
     ------------------------------------------------------- */

  async function send() {
    if (generating) return;

    const input = $("#chatInput");

    if (!input) return;

    const text = input.value.trim();

    if (!text && !files.length) {
      return;
    }

    const chat = ensureChat();

    const attachments =
      files.splice(0, 4);

    renderFiles();

    chat.messages.push({
      role: "user",
      content: text,
      attachments,
      createdAt: new Date().toISOString()
    });

    if (
      chat.messages.filter(
        message => message.role === "user"
      ).length === 1
    ) {
      chat.title = titleFrom(text);
    }

    chat.updatedAt =
      new Date().toISOString();

    persist();

    input.value = "";

    resizeInput();
    renderMessages();

    const assistant = {
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };

    chat.messages.push(assistant);

    generating = true;

    controller = new AbortController();

    $("#sendBtn")?.classList.add("hidden");
    $("#stopBtn")?.classList.remove("hidden");

    setConnectionStatus("Generating…");

    renderMessages();

    try {
      const researchToggle =
        $("#researchToggle");

      const research =
        researchToggle?.getAttribute(
          "aria-pressed"
        ) === "true";

      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          signal: controller.signal,

          body: JSON.stringify({
            messages:
              payloadMessages(chat),

            model:
              $("#modelSelect")?.value ||
              "auto",

            research,

            responseLength:
              settings.responseLength,

            responseStyle:
              settings.responseStyle,

            memory:
              settings.memory,

            customInstructions:
              settings.instructions
          })
        }
      );

      if (!response.ok) {
        let message =
          `Request failed (${response.status})`;

        try {
          const data =
            await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {}

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "No response stream was returned."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const result =
          await reader.read();

        if (result.done) break;

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

          if (
            !raw ||
            raw === "[DONE]"
          ) {
            continue;
          }

          try {
            const data =
              JSON.parse(raw);

            if (data.type === "delta") {
              assistant.content +=
                data.content || "";

              renderMessages();
            }

            if (data.type === "error") {
              throw new Error(
                data.error ||
                "Generation failed."
              );
            }
          } catch (error) {
            if (
              error instanceof SyntaxError
            ) {
              continue;
            }

            throw error;
          }
        }
      }

      if (!assistant.content.trim()) {
        assistant.content =
          "No response was returned.";
      }
    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        assistant.content =
          assistant.content.trim()
            ? assistant.content +
              "\n\nGeneration stopped."
            : "Generation stopped.";
      } else {
        assistant.error = true;

        assistant.content =
          error?.message ||
          "Request failed.";

        toast(
          assistant.content,
          "error"
        );
      }
    } finally {
      generating = false;
      controller = null;

      chat.updatedAt =
        new Date().toISOString();

      persist();
      renderMessages();

      $("#sendBtn")?.classList.remove(
        "hidden"
      );

      $("#stopBtn")?.classList.add(
        "hidden"
      );

      setConnectionStatus("Ready");
    }
  }

  /* -------------------------------------------------------
     CONNECTION STATUS
     ------------------------------------------------------- */

  function setConnectionStatus(text) {
    const status =
      $("#connectionStatus");

    if (!status) return;

    status.innerHTML = `
      <i></i>
      ${escapeHTML(text)}
    `;
  }

  /* -------------------------------------------------------
     COPY
     ------------------------------------------------------- */

  async function copyMessage(index) {
    const chat = current();

    const message =
      chat?.messages?.[index];

    if (!message) return;

    try {
      await navigator.clipboard.writeText(
        message.content || ""
      );

      toast(
        "Response copied",
        "success"
      );
    } catch {
      toast(
        "Could not copy response",
        "error"
      );
    }
  }

  /* -------------------------------------------------------
     DELETE MESSAGE
     ------------------------------------------------------- */

  function deleteMessage(index) {
    const chat = current();

    if (!chat?.messages?.[index]) {
      return;
    }

    chat.messages.splice(index, 1);

    chat.updatedAt =
      new Date().toISOString();

    persist();
    renderMessages();
  }

  /* -------------------------------------------------------
     EDIT USER MESSAGE
     ------------------------------------------------------- */

  function editMessage(index) {
    const chat = current();

    const message =
      chat?.messages?.[index];

    if (!message || message.role !== "user") {
      return;
    }

    const input = $("#chatInput");

    if (!input) return;

    input.value = message.content || "";

    if (message.attachments?.length) {
      files.push(
        ...message.attachments.slice(
          0,
          4 - files.length
        )
      );

      renderFiles();
    }

    chat.messages.splice(index, 1);

    chat.updatedAt =
      new Date().toISOString();

    persist();
    renderMessages();

    input.focus();
    resizeInput();

    toast(
      "Message ready to edit",
      "success"
    );
  }

  /* -------------------------------------------------------
     REGENERATE
     ------------------------------------------------------- */

  async function regenerate(index) {
    if (generating) return;

    const chat = current();

    if (!chat) return;

    const assistant =
      chat.messages[index];

    if (
      !assistant ||
      assistant.role !== "assistant"
    ) {
      return;
    }

    const previousUser =
      chat.messages
        .slice(0, index)
        .reverse()
        .find(
          message =>
            message.role === "user"
        );

    if (!previousUser) {
      toast(
        "No user message to regenerate",
        "error"
      );

      return;
    }

    chat.messages.splice(index, 1);

    chat.updatedAt =
      new Date().toISOString();

    persist();
    renderMessages();

    generating = false;

    await generateFromExistingChat(chat);
  }

  /* -------------------------------------------------------
     GENERATE EXISTING CHAT
     ------------------------------------------------------- */

  async function generateFromExistingChat(chat) {
    if (generating) return;

    const assistant = {
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };

    chat.messages.push(assistant);

    generating = true;

    controller =
      new AbortController();

    $("#sendBtn")?.classList.add("hidden");
    $("#stopBtn")?.classList.remove("hidden");

    setConnectionStatus("Generating…");

    renderMessages();

    try {
      const researchToggle =
        $("#researchToggle");

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            signal: controller.signal,

            body: JSON.stringify({
              messages:
                payloadMessages(chat),

              model:
                $("#modelSelect")?.value ||
                "auto",

              research:
                researchToggle?.getAttribute(
                  "aria-pressed"
                ) === "true",

              responseLength:
                settings.responseLength,

              responseStyle:
                settings.responseStyle,

              memory:
                settings.memory,

              customInstructions:
                settings.instructions
            })
          }
        );

      if (!response.ok) {
        let message =
          `Request failed (${response.status})`;

        try {
          const data =
            await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {}

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "No response stream was returned."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const result =
          await reader.read();

        if (result.done) break;

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

          if (
            !raw ||
            raw === "[DONE]"
          ) {
            continue;
          }

          try {
            const data =
              JSON.parse(raw);

            if (data.type === "delta") {
              assistant.content +=
                data.content || "";

              renderMessages();
            }

            if (data.type === "error") {
              throw new Error(
                data.error ||
                "Generation failed."
              );
            }
          } catch (error) {
            if (
              error instanceof SyntaxError
            ) {
              continue;
            }

            throw error;
          }
        }
      }

      if (!assistant.content.trim()) {
        assistant.content =
          "No response was returned.";
      }
    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        assistant.content =
          assistant.content.trim()
            ? assistant.content +
              "\n\nGeneration stopped."
            : "Generation stopped.";
      } else {
        assistant.error = true;

        assistant.content =
          error?.message ||
          "Request failed.";

        toast(
          assistant.content,
          "error"
        );
      }
    } finally {
      generating = false;
      controller = null;

      chat.updatedAt =
        new Date().toISOString();

      persist();
      renderMessages();

      $("#sendBtn")?.classList.remove(
        "hidden"
      );

      $("#stopBtn")?.classList.add(
        "hidden"
      );

      setConnectionStatus("Ready");
    }
  }

  /* -------------------------------------------------------
     SETTINGS
     ------------------------------------------------------- */

  function loadSettingsUI() {
    const length =
      $("#responseLength");

    const style =
      $("#responseStyle");

    const instructions =
      $("#customInstructions");

    if (length) {
      length.value =
        settings.responseLength;
    }

    if (style) {
      style.value =
        settings.responseStyle;
    }

    if (instructions) {
      instructions.value =
        settings.instructions;
    }

    const memory =
      $("#memoryToggle");

    if (memory) {
      memory.setAttribute(
        "aria-checked",
        String(settings.memory)
      );
    }
  }

  function saveSettings() {
    settings.responseLength =
      $("#responseLength")?.value ||
      "medium";

    settings.responseStyle =
      $("#responseStyle")?.value ||
      "balanced";

    settings.instructions =
      (
        $("#customInstructions")?.value ||
        ""
      ).slice(0, 5000);

    save(K.settings, settings);

    toast(
      "Settings saved",
      "success"
    );
  }

  function toggleMemory() {
    settings.memory =
      !settings.memory;

    save(K.settings, settings);

    loadSettingsUI();

    toast(
      settings.memory
        ? "Memory enabled"
        : "Memory disabled",
      "success"
    );
  }

  /* -------------------------------------------------------
     EXPORT
     ------------------------------------------------------- */

  function exportData() {
    try {
      const blob =
        new Blob(
          [
            JSON.stringify(
              chats,
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
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "ozlind-history.json";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      toast(
        "History exported",
        "success"
      );
    } catch {
      toast(
        "Could not export history",
        "error"
      );
    }
  }

  /* -------------------------------------------------------
     IMPORT
     ------------------------------------------------------- */

  function importData(file) {
    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const data =
          JSON.parse(
            reader.result
          );

        if (!Array.isArray(data)) {
          throw new Error();
        }

        chats = data
          .filter(
            chat =>
              chat &&
              chat.id &&
              Array.isArray(
                chat.messages
              )
          )
          .slice(0, 100);

        active =
          chats[0]?.id || null;

        persist();

        renderMessages();
        renderHistory();

        toast(
          "History imported",
          "success"
        );
      } catch {
        toast(
          "Invalid history file",
          "error"
        );
      }
    };

    reader.onerror = () => {
      toast(
        "Could not read history file",
        "error"
      );
    };

    reader.readAsText(file);
  }

  /* -------------------------------------------------------
     THEME
     ------------------------------------------------------- */

  function toggleTheme() {
    const currentTheme =
      load(K.theme, "dark");

    const next =
      currentTheme === "dark"
        ? "light"
        : "dark";

    document.body.dataset.theme =
      next;

    save(K.theme, next);

    const button =
      $("#themeToggle");

    if (button) {
      button.innerHTML =
        icon("i-settings", "ui-icon small");
    }
  }

  function loadTheme() {
    const saved =
      load(K.theme, "dark");

    document.body.dataset.theme =
      saved;

    const button =
      $("#themeToggle");

    if (button) {
      button.innerHTML =
        icon("i-settings", "ui-icon small");
    }
  }

  /* -------------------------------------------------------
     CLICK EVENTS
     ------------------------------------------------------- */

  document.addEventListener(
    "click",
    event => {
      const view =
        event.target.closest(
          "[data-view]"
        );

      if (view) {
        showView(
          view.dataset.view
        );
        return;
      }

      const prompt =
        event.target.closest(
          "[data-prompt]"
        );

      if (prompt) {
        const input =
          $("#chatInput");

        if (input) {
          input.value =
            prompt.dataset.prompt;

          resizeInput();
          showView("chat");
          input.focus();
        }

        return;
      }

      const open =
        event.target.closest(
          "[data-open]"
        );

      if (open) {
        active =
          open.dataset.open;

        persist();
        renderMessages();
        showView("chat");

        return;
      }

      const conversationDelete =
        event.target.closest(
          "[data-delete]"
        );

      if (conversationDelete) {
        const id =
          conversationDelete.dataset.delete;

        if (
          !confirm(
            "Delete this conversation?"
          )
        ) {
          return;
        }

        chats =
          chats.filter(
            chat => chat.id !== id
          );

        if (active === id) {
          active =
            chats[0]?.id || null;
        }

        persist();

        renderMessages();
        renderHistory();

        toast(
          "Conversation deleted",
          "success"
        );

        return;
      }

      const copy =
        event.target.closest(
          "[data-copy]"
        );

      if (copy) {
        copyMessage(
          Number(copy.dataset.copy)
        );
        return;
      }

      const edit =
        event.target.closest(
          "[data-edit]"
        );

      if (edit) {
        editMessage(
          Number(edit.dataset.edit)
        );
        return;
      }

      const regenerateButton =
        event.target.closest(
          "[data-regenerate]"
        );

      if (regenerateButton) {
        regenerate(
          Number(
            regenerateButton.dataset
              .regenerate
          )
        );

        return;
      }

      const deleteMessageButton =
        event.target.closest(
          "[data-delete-message]"
        );

      if (deleteMessageButton) {
        deleteMessage(
          Number(
            deleteMessageButton.dataset
              .deleteMessage
          )
        );

        return;
      }

      const removeFile =
        event.target.closest(
          "[data-file]"
        );

      if (removeFile) {
        files.splice(
          Number(removeFile.dataset.file),
          1
        );

        renderFiles();

        return;
      }

      if (
        event.target.closest(
          "#newChatBtn"
        )
      ) {
        newChat();
        return;
      }

      if (
        event.target.closest(
          "#themeToggle"
        )
      ) {
        toggleTheme();
        return;
      }

      if (
        event.target.closest(
          "#researchToggle"
        )
      ) {
        const button =
          $("#researchToggle");

        if (!button) return;

        const enabled =
          button.getAttribute(
            "aria-pressed"
          ) === "true";

        button.setAttribute(
          "aria-pressed",
          String(!enabled)
        );

        const label =
          button.querySelector(
            "span"
          );

        if (label) {
          label.textContent =
            !enabled
              ? "ON"
              : "OFF";
        }

        return;
      }

      if (
        event.target.closest(
          "#mobileNavBtn"
        )
      ) {
        $(".sidebar")
          ?.classList.add("open");

        $("#sidebarOverlay")
          ?.classList.add("open");

        return;
      }

      if (
        event.target.closest(
          "#sidebarOverlay"
        )
      ) {
        $(".sidebar")
          ?.classList.remove("open");

        $("#sidebarOverlay")
          ?.classList.remove("open");

        return;
      }

      if (
        event.target.closest(
          "#attachBtn"
        )
      ) {
        $("#fileInput")?.click();
        return;
      }

      if (
        event.target.closest(
          "#stopBtn"
        )
      ) {
        controller?.abort();
        return;
      }

      if (
        event.target.closest(
          "#memoryToggle"
        )
      ) {
        toggleMemory();
        return;
      }

      if (
        event.target.closest(
          "#saveInstructionsBtn"
        )
      ) {
        saveSettings();
        return;
      }

      if (
        event.target.closest(
          "#exportHistoryBtn"
        )
      ) {
        exportData();
        return;
      }

      if (
        event.target.closest(
          "#importHistoryBtn"
        )
      ) {
        $("#historyFileInput")?.click();
        return;
      }

      if (
        event.target.closest(
          "#clearHistoryBtn"
        )
      ) {
        if (
          !confirm(
            "Delete all local conversation history?"
          )
        ) {
          return;
        }

        chats = [];
        active = null;

        persist();

        renderMessages();
        renderHistory();

        toast(
          "History cleared",
          "success"
        );

        return;
      }

      if (
        event.target.closest(
          "[data-focus-chat]"
        )
      ) {
        showView("chat");
      }
    }
  );

  /* -------------------------------------------------------
     FORM
     ------------------------------------------------------- */

  const chatForm =
    $("#chatForm");

  if (chatForm) {
    chatForm.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        send();
      }
    );
  }

  /* -------------------------------------------------------
     INPUT EVENTS
     ------------------------------------------------------- */

  const chatInput =
    $("#chatInput");

  if (chatInput) {
    chatInput.addEventListener(
      "input",
      resizeInput
    );

    chatInput.addEventListener(
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
  }

  /* -------------------------------------------------------
     FILE INPUT
     ------------------------------------------------------- */

  const fileInput =
    $("#fileInput");

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      event => {
        addFiles(
          event.target.files
        );

        event.target.value = "";
      }
    );
  }

  /* -------------------------------------------------------
     HISTORY SEARCH
     ------------------------------------------------------- */

  const historySearch =
    $("#conversationSearch");

  if (historySearch) {
    historySearch.addEventListener(
      "input",
      event => {
        renderHistory(
          event.target.value
        );
      }
    );
  }

  /* -------------------------------------------------------
     IMPORT INPUT
     ------------------------------------------------------- */

  const historyFileInput =
    $("#historyFileInput");

  if (historyFileInput) {
    historyFileInput.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        if (file) {
          importData(file);
        }

        event.target.value = "";
      }
    );
  }

  /* -------------------------------------------------------
     STARTUP
     ------------------------------------------------------- */

  window.addEventListener(
    "load",
    () => {
      loadTheme();

      if (!chats.length) {
        newChat();
      } else {
        renderMessages();
        renderHistory();
        loadSettingsUI();
      }

      resizeInput();
      renderFiles();
    }
  );

})();
