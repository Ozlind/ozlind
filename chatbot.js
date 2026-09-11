(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const K = {
    chats: "ozlind:v3:chats",
    settings: "ozlind:v3:settings",
    theme: "ozlind:v3:theme",
    visitor: "ozlind:v1:visitor"
  };

  const MAX_CHATS = 100;
  const MAX_ATTACHMENTS = 4;
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
  const MAX_CONTEXT_MESSAGES = 20;

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
    mode: "auto",
    ...load(K.settings, {})
  };

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
      toast("Local storage is full.", "error");
    }
  }

  function uid() {
    return crypto?.randomUUID?.() ||
      `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function visitorId() {
    let value = localStorage.getItem(K.visitor);

    if (!value) {
      value = uid();
      localStorage.setItem(K.visitor, value);
    }

    return value;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function toast(message, type = "") {
    const stack = $("#toastStack");
    if (!stack) return;

    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;

    stack.appendChild(item);

    setTimeout(() => item.remove(), 3200);
  }

  function current() {
    return chats.find(chat => chat.id === active);
  }

  function persist() {
    chats.sort(
      (a, b) =>
        new Date(b.updatedAt || 0) -
        new Date(a.updatedAt || 0)
    );

    chats = chats.slice(0, MAX_CHATS);

    save(K.chats, chats);
  }

  function newChat() {
    if (generating) {
      toast("Please stop the current response first.", "error");
      return;
    }

    const chat = {
      id: uid(),
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    chats.unshift(chat);
    active = chat.id;

    files = [];
    renderFiles();
    persist();
    renderMessages();
    renderHistory();
    showView("chat");

    setTimeout(() => $("#chatInput")?.focus(), 50);
  }

  function ensureChat() {
    if (!current()) newChat();
    return current();
  }

  function showView(view) {
    $$(".page").forEach(page => {
      page.classList.toggle("active", page.dataset.page === view);
    });

    $$(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    const titles = {
      chat: "AI Chat",
      history: "History",
      research: "Research",
      vision: "Vision",
      settings: "Settings"
    };

    if ($("#topbarTitle")) {
      $("#topbarTitle").textContent = titles[view] || "OZLIND";
    }

    if (view === "history") renderHistory();
    if (view === "settings") loadSettingsUI();

    $(".sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("open");
  }

  function formatText(text) {
    const safe = esc(text);

    return safe
      .replace(/```([\s\S]*?)```/g, (_, code) => {
        return `
          <pre class="code-block">
            <code>${code.trim()}</code>
          </pre>
        `;
      })
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function renderMessageActions(index) {
    return `
      <div class="message-actions">
        <button type="button" data-copy="${index}" title="Copy">
          Copy
        </button>

        <button type="button" data-edit="${index}" title="Edit">
          Edit
        </button>

        <button type="button" data-regenerate="${index}" title="Regenerate">
          Regenerate
        </button>

        <button type="button" data-delete-message="${index}" title="Delete">
          Delete
        </button>
      </div>
    `;
  }

  function renderMessageImages(attachments) {
    if (!Array.isArray(attachments) || !attachments.length) {
      return "";
    }

    return `
      <div class="message-images">
        ${attachments.map((image, index) => `
          <button
            type="button"
            class="message-image"
            data-image-preview="${index}"
            data-image-src="${esc(image.dataUrl)}"
            aria-label="Open image"
          >
            <img
              src="${esc(image.dataUrl)}"
              alt="${esc(image.name || "Uploaded image")}"
              loading="lazy"
            >
          </button>
        `).join("")}
      </div>
    `;
  }

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
        (message.error ? " error" : "") +
        (message.pending ? " pending" : "");

      const isUser = message.role === "user";
      const isAssistant = message.role === "assistant";

      const body = message.content
        ? formatText(message.content)
        : message.pending
          ? `<div class="typing-indicator">
               <span></span><span></span><span></span>
             </div>`
          : "";

      article.innerHTML = `
        <div class="message-meta">
          ${isUser ? "You" : "OZLIND AI"}
        </div>

        ${body ? `<div class="message-body">${body}</div>` : ""}

        ${isUser ? renderMessageImages(message.attachments) : ""}

        ${
          isAssistant && !message.pending && !message.error
            ? renderMessageActions(index)
            : ""
        }

        ${
          message.error
            ? `<div class="message-error">
                 ${esc(message.content || "Something went wrong.")}
               </div>`
            : ""
        }
      `;

      box.appendChild(article);
    });

    box.scrollTop = box.scrollHeight;
  }

  function renderHistory(filter = "") {
    const box = $("#conversationList");
    if (!box) return;

    box.innerHTML = "";

    const query = filter.trim().toLowerCase();

    const filtered = chats.filter(chat => {
      const searchable = [
        chat.title,
        ...chat.messages.map(message => message.content || "")
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    if (!filtered.length) {
      box.innerHTML = `
        <div class="history-empty">
          No conversations found.
        </div>
      `;
      return;
    }

    filtered.forEach(chat => {
      const item = document.createElement("div");
      item.className =
        `history-item ${chat.id === active ? "active" : ""}`;

      item.innerHTML = `
        <div class="history-main">
          <b>${esc(chat.title || "New chat")}</b>
          <small>
            ${chat.messages.length} message${chat.messages.length === 1 ? "" : "s"}
          </small>
        </div>

        <div class="history-actions">
          <button
            type="button"
            class="icon-btn"
            data-open="${chat.id}"
            aria-label="Open conversation"
          >→</button>

          <button
            type="button"
            class="icon-btn"
            data-delete="${chat.id}"
            aria-label="Delete conversation"
          >×</button>
        </div>
      `;

      box.appendChild(item);
    });
  }

  function titleFrom(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return "New chat";

    return clean
      .replace(/[?.!]+$/, "")
      .slice(0, 58);
  }

  function resizeInput() {
    const input = $("#chatInput");
    if (!input) return;

    input.style.height = "auto";
    input.style.height =
      Math.min(input.scrollHeight, 180) + "px";
  }

  function renderFiles() {
    const box = $("#chatAttachments");
    if (!box) return;

    box.innerHTML = "";

    files.forEach((file, index) => {
      const item = document.createElement("div");

      item.className = "attachment";

      item.innerHTML = `
        <div class="attachment-preview">
          <img
            src="${esc(file.dataUrl)}"
            alt="${esc(file.name || "Attachment")}"
          >
        </div>

        <div class="attachment-info">
          <span>${esc(file.name || "Image")}</span>
        </div>

        <button
          type="button"
          data-file="${index}"
          aria-label="Remove attachment"
        >×</button>
      `;

      box.appendChild(item);
    });

    const indicator = $("#contextIndicator");

    if (indicator) {
      indicator.textContent =
        `${files.length} attachment${files.length === 1 ? "" : "s"}`;
    }
  }

  function dataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  async function addFiles(list) {
    const incoming = [...(list || [])];

    if (!incoming.length) return;

    for (
      const file of incoming.slice(
        0,
        MAX_ATTACHMENTS - files.length
      )
    ) {
      if (!file.type.startsWith("image/")) {
        toast("Only image files are supported.", "error");
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast("Image must be smaller than 8MB.", "error");
        continue;
      }

      try {
        const dataUrl = await dataURL(file);

        files.push({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl
        });
      } catch {
        toast(`Could not read ${file.name}.`, "error");
      }
    }

    if (incoming.length + files.length > MAX_ATTACHMENTS) {
      toast("Maximum 4 images per message.", "error");
    }

    renderFiles();
  }

  /*
   * IMPORTANT:
   * Never send the temporary assistant placeholder.
   *
   * The old flow added:
   *
   * user
   * assistant ""
   *
   * and then serialized both.
   *
   * Some providers reject that request with:
   * "Requests ending with a model turn are not supported."
   *
   * This function explicitly removes the pending assistant
   * before constructing the API payload.
   */
  function payloadMessages(chat) {
    if (!chat) return [];

    let source = Array.isArray(chat.messages)
      ? [...chat.messages]
      : [];

    const last = source[source.length - 1];

    if (
      last &&
      last.role === "assistant" &&
      (last.pending || !String(last.content || "").trim())
    ) {
      source.pop();
    }

    if (settings.memory) {
      source = source.slice(-MAX_CONTEXT_MESSAGES);
    } else {
      source = source.slice(-1);
    }

    return source
      .filter(message =>
        message &&
        (message.role === "user" || message.role === "assistant")
      )
      .map(message => {
        if (
          message.role === "user" &&
          Array.isArray(message.attachments) &&
          message.attachments.length
        ) {
          return {
            role: "user",
            content: [
              {
                type: "text",
                text: message.content || "Please analyse this image."
              },

              ...message.attachments
                .slice(0, MAX_ATTACHMENTS)
                .map(attachment => ({
                  type: "image_url",
                  image_url: {
                    url: attachment.dataUrl
                  }
                }))
            ]
          };
        }

        return {
          role: message.role,
          content: String(message.content || "")
        };
      });
  }

  function selectedMode() {
    return $("#modeSelect")?.value ||
      $("#aiMode")?.value ||
      settings.mode ||
      "auto";
  }

  function isResearchEnabled() {
    return $("#researchToggle")
      ?.getAttribute("aria-pressed") === "true";
  }

  function setGeneratingState(value) {
    generating = value;

    $("#sendBtn")?.classList.toggle("hidden", value);
    $("#stopBtn")?.classList.toggle("hidden", !value);

    const status = $("#connectionStatus");

    if (status) {
      status.innerHTML = value
        ? "<i></i> Generating…"
        : "<i></i> Ready";
    }

    $("#chatInput")?.toggleAttribute("disabled", value);
  }

  async function send() {
    if (generating) return;

    const input = $("#chatInput");
    const text = input?.value.trim() || "";

    if (!text && !files.length) return;

    const chat = ensureChat();

    const attachments = files.splice(
      0,
      MAX_ATTACHMENTS
    );

    renderFiles();

    const userMessage = {
      role: "user",
      content: text,
      attachments,
      createdAt: new Date().toISOString()
    };

    chat.messages.push(userMessage);

    if (
      chat.messages.length === 1 ||
      chat.title === "New chat"
    ) {
      chat.title = titleFrom(text || "Image analysis");
    }

    chat.updatedAt = new Date().toISOString();

    if (input) {
      input.value = "";
      resizeInput();
    }

    persist();
    renderMessages();

    /*
     * Create the assistant placeholder only AFTER
     * the user message has been stored.
     *
     * payloadMessages() will explicitly remove this
     * placeholder before sending the request.
     */
    const assistant = {
      role: "assistant",
      content: "",
      pending: true,
      createdAt: new Date().toISOString()
    };

    chat.messages.push(assistant);

    setGeneratingState(true);
    controller = new AbortController();

    renderMessages();

    try {
      const payload = {
        messages: payloadMessages(chat),

        model:
          $("#modelSelect")?.value ||
          "auto",

        mode: selectedMode(),

        research: isResearchEnabled(),

        responseLength:
          settings.responseLength,

        responseStyle:
          settings.responseStyle,

        memory:
          settings.memory,

        customInstructions:
          settings.instructions,

        visitorId:
          visitorId(),

        conversationId:
          chat.id
      };

      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },

        signal: controller.signal,

        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message =
          `Request failed (${response.status})`;

        try {
          const data = await response.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {}

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("The server returned no response stream.");
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const lines =
          buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }

          const raw =
            line.slice(5).trim();

          if (!raw || raw === "[DONE]") {
            continue;
          }

          let event;

          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          /*
           * Current backend sends:
           * { event:"message", type:"delta", content:"..." }
           */
          if (
            event.type === "delta" &&
            typeof event.content === "string"
          ) {
            assistant.content += event.content;
            assistant.pending = false;

            renderMessages();
            continue;
          }

          if (event.type === "error") {
            throw new Error(
              event.error ||
              "Generation failed."
            );
          }

          /*
           * Some future/alternate stream formats
           * may send event:"delta".
           */
          if (
            event.event === "delta" &&
            typeof event.content === "string"
          ) {
            assistant.content += event.content;
            assistant.pending = false;

            renderMessages();
          }
        }
      }

      if (!assistant.content.trim()) {
        assistant.content =
          "No response was returned.";
      }

      assistant.pending = false;
      assistant.error = false;

    } catch (error) {
      assistant.pending = false;

      if (error?.name === "AbortError") {
        assistant.content =
          assistant.content.trim()
            ? `${assistant.content}\n\nGeneration stopped.`
            : "Generation stopped.";
      } else {
        assistant.error = true;
        assistant.content =
          error?.message ||
          "Something went wrong. Please try again.";

        toast(
          assistant.content,
          "error"
        );
      }
    } finally {
      assistant.pending = false;

      chat.updatedAt =
        new Date().toISOString();

      persist();
      renderMessages();

      setGeneratingState(false);
      controller = null;
    }
  }

  function stopGeneration() {
    if (!generating) return;

    controller?.abort();
  }

  async function copyMessage(index) {
    const chat = current();
    const message = chat?.messages[index];

    if (!message?.content) return;

    try {
      await navigator.clipboard.writeText(
        message.content
      );

      toast("Copied to clipboard.", "success");
    } catch {
      toast("Could not copy the response.", "error");
    }
  }

  function editMessage(index) {
    if (generating) return;

    const chat = current();
    const message = chat?.messages[index];

    if (!message || message.role !== "user") {
      return;
    }

    const input = $("#chatInput");
    if (!input) return;

    input.value = message.content || "";

    files = Array.isArray(message.attachments)
      ? [...message.attachments]
      : [];

    chat.messages.splice(index);

    chat.updatedAt =
      new Date().toISOString();

    persist();
    renderFiles();
    renderMessages();
    showView("chat");

    input.focus();
    resizeInput();
  }

  function deleteMessage(index) {
    if (generating) {
      toast("Stop generation before deleting messages.", "error");
      return;
    }

    const chat = current();

    if (!chat) return;

    chat.messages.splice(index, 1);

    if (!chat.messages.length) {
      chat.title = "New chat";
    }

    chat.updatedAt =
      new Date().toISOString();

    persist();
    renderMessages();
    renderHistory();
  }

  function regenerate(index) {
    if (generating) return;

    const chat = current();

    if (!chat) return;

    const assistant = chat.messages[index];

    if (
      !assistant ||
      assistant.role !== "assistant"
    ) {
      return;
    }

    const userIndex = index - 1;

    const userMessage =
      chat.messages[userIndex];

    if (
      !userMessage ||
      userMessage.role !== "user"
    ) {
      toast("Unable to regenerate this response.", "error");
      return;
    }

    chat.messages.splice(index);

    sendExistingConversation(chat);
  }

  async function sendExistingConversation(chat) {
    if (generating) return;

    const assistant = {
      role: "assistant",
      content: "",
      pending: true,
      createdAt: new Date().toISOString()
    };

    chat.messages.push(assistant);

    setGeneratingState(true);
    controller = new AbortController();

    renderMessages();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },

        signal: controller.signal,

        body: JSON.stringify({
          messages: payloadMessages(chat),
          model: $("#modelSelect")?.value || "auto",
          mode: selectedMode(),
          research: isResearchEnabled(),
          responseLength: settings.responseLength,
          responseStyle: settings.responseStyle,
          memory: settings.memory,
          customInstructions: settings.instructions,
          visitorId: visitorId(),
          conversationId: chat.id
        })
      });

      if (!response.ok) {
        let message =
          `Request failed (${response.status})`;

        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {}

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("No response stream.");
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const lines =
          buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const raw =
            line.slice(5).trim();

          if (!raw || raw === "[DONE]") continue;

          try {
            const event =
              JSON.parse(raw);

            if (
              event.type === "delta" &&
              typeof event.content === "string"
            ) {
              assistant.content +=
                event.content;

              assistant.pending = false;

              renderMessages();
            }

            if (event.type === "error") {
              throw new Error(
                event.error ||
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

      assistant.pending = false;

    } catch (error) {
      assistant.pending = false;
      assistant.error = true;

      assistant.content =
        error?.name === "AbortError"
          ? "Generation stopped."
          : error?.message ||
            "Request failed.";

      if (error?.name !== "AbortError") {
        toast(
          assistant.content,
          "error"
        );
      }
    } finally {
      assistant.pending = false;

      chat.updatedAt =
        new Date().toISOString();

      persist();
      renderMessages();

      setGeneratingState(false);
      controller = null;
    }
  }

  function previewImage(src) {
    if (!src) return;

    let modal = $("#imagePreviewModal");

    if (!modal) {
      modal = document.createElement("div");

      modal.id = "imagePreviewModal";
      modal.className = "image-preview-modal";

      modal.innerHTML = `
        <button
          type="button"
          class="image-preview-close"
          aria-label="Close image"
        >×</button>

        <div class="image-preview-stage">
          <img alt="Image preview">
        </div>
      `;

      document.body.appendChild(modal);

      modal.addEventListener("click", event => {
        if (
          event.target === modal ||
          event.target.closest(".image-preview-close")
        ) {
          modal.classList.remove("open");
        }
      });
    }

    const image = modal.querySelector("img");

    if (image) {
      image.src = src;
    }

    modal.classList.add("open");
  }

  function loadSettingsUI() {
    if ($("#responseLength")) {
      $("#responseLength").value =
        settings.responseLength;
    }

    if ($("#responseStyle")) {
      $("#responseStyle").value =
        settings.responseStyle;
    }

    if ($("#customInstructions")) {
      $("#customInstructions").value =
        settings.instructions;
    }

    $("#memoryToggle")
      ?.setAttribute(
        "aria-checked",
        String(settings.memory)
      );

    if ($("#modeSelect")) {
      $("#modeSelect").value =
        settings.mode || "auto";
    }

    if ($("#aiMode")) {
      $("#aiMode").value =
        settings.mode || "auto";
    }
  }

  function saveSettings() {
    settings.responseLength =
      $("#responseLength")?.value ||
      settings.responseLength;

    settings.responseStyle =
      $("#responseStyle")?.value ||
      settings.responseStyle;

    settings.instructions =
      ($("#customInstructions")?.value || "")
        .slice(0, 5000);

    settings.mode =
      $("#modeSelect")?.value ||
      $("#aiMode")?.value ||
      settings.mode;

    save(K.settings, settings);

    toast(
      "Settings saved.",
      "success"
    );
  }

  function toggleMemory() {
    settings.memory = !settings.memory;

    save(K.settings, settings);
    loadSettingsUI();

    toast(
      settings.memory
        ? "Conversation memory enabled."
        : "Conversation memory disabled.",
      "success"
    );
  }

  function exportData() {
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

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    toast(
      "History exported.",
      "success"
    );
  }

  function importData(file) {
    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const imported =
          JSON.parse(reader.result);

        if (!Array.isArray(imported)) {
          throw new Error();
        }

        const valid =
          imported
            .filter(chat =>
              chat &&
              chat.id &&
              Array.isArray(chat.messages)
            )
            .slice(0, MAX_CHATS);

        chats = valid;
        active = chats[0]?.id || null;

        persist();
        renderMessages();
        renderHistory();

        toast(
          "History imported.",
          "success"
        );

      } catch {
        toast(
          "Invalid history file.",
          "error"
        );
      }
    };

    reader.readAsText(file);
  }

  function toggleTheme() {
    const currentTheme =
      document.body.dataset.theme ||
      "dark";

    const next =
      currentTheme === "light"
        ? "dark"
        : "light";

    document.body.dataset.theme = next;

    save(K.theme, next);

    if ($("#themeToggle")) {
      $("#themeToggle").textContent =
        next === "dark"
          ? "☾"
          : "☀";
    }
  }

  function initializeTheme() {
    const theme =
      load(K.theme, "dark");

    document.body.dataset.theme =
      theme === "light"
        ? "light"
        : "dark";

    if ($("#themeToggle")) {
      $("#themeToggle").textContent =
        document.body.dataset.theme === "dark"
          ? "☾"
          : "☀";
    }
  }

  document.addEventListener("click", event => {
    const view =
      event.target.closest("[data-view]");

    if (view) {
      showView(view.dataset.view);
      return;
    }

    const prompt =
      event.target.closest("[data-prompt]");

    if (prompt) {
      const input = $("#chatInput");

      if (input) {
        input.value =
          prompt.dataset.prompt || "";

        resizeInput();
        showView("chat");
        input.focus();
      }

      return;
    }

    const open =
      event.target.closest("[data-open]");

    if (open) {
      active = open.dataset.open;

      persist();
      renderMessages();
      renderHistory();
      showView("chat");

      return;
    }

    const deleteChat =
      event.target.closest("[data-delete]");

    if (deleteChat) {
      if (generating) {
        toast(
          "Stop generation first.",
          "error"
        );
        return;
      }

      const id =
        deleteChat.dataset.delete;

      chats =
        chats.filter(chat =>
          chat.id !== id
        );

      if (active === id) {
        active =
          chats[0]?.id || null;
      }

      persist();
      renderMessages();
      renderHistory();

      return;
    }

    const copy =
      event.target.closest("[data-copy]");

    if (copy) {
      copyMessage(
        Number(copy.dataset.copy)
      );
      return;
    }

    const edit =
      event.target.closest("[data-edit]");

    if (edit) {
      editMessage(
        Number(edit.dataset.edit)
      );
      return;
    }

    const regenerateButton =
      event.target.closest("[data-regenerate]");

    if (regenerateButton) {
      regenerate(
        Number(
          regenerateButton.dataset.regenerate
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
          deleteMessageButton.dataset.deleteMessage
        )
      );
      return;
    }

    const removeFile =
      event.target.closest("[data-file]");

    if (removeFile) {
      files.splice(
        Number(removeFile.dataset.file),
        1
      );

      renderFiles();
      return;
    }

    const image =
      event.target.closest("[data-image-src]");

    if (image) {
      previewImage(
        image.dataset.imageSrc
      );
      return;
    }

    if (
      event.target.closest("#newChatBtn")
    ) {
      newChat();
      return;
    }

    if (
      event.target.closest("#themeToggle")
    ) {
      toggleTheme();
      return;
    }

    if (
      event.target.closest("#researchToggle")
    ) {
      const button =
        $("#researchToggle");

      const enabled =
        button.getAttribute(
          "aria-pressed"
        ) === "true";

      button.setAttribute(
        "aria-pressed",
        String(!enabled)
      );

      const label =
        button.querySelector("span");

      if (label) {
        label.textContent =
          !enabled
            ? "ON"
            : "OFF";
      }

      return;
    }

    if (
      event.target.closest("#mobileNavBtn")
    ) {
      $(".sidebar")
        ?.classList.add("open");

      $("#sidebarOverlay")
        ?.classList.add("open");

      return;
    }

    if (
      event.target.closest("#sidebarOverlay")
    ) {
      $(".sidebar")
        ?.classList.remove("open");

      $("#sidebarOverlay")
        ?.classList.remove("open");

      return;
    }

    if (
      event.target.closest("#attachBtn")
    ) {
      $("#fileInput")?.click();
      return;
    }

    if (
      event.target.closest("#stopBtn")
    ) {
      stopGeneration();
      return;
    }

    if (
      event.target.closest("#memoryToggle")
    ) {
      toggleMemory();
      return;
    }

    if (
      event.target.closest("#saveInstructionsBtn")
    ) {
      saveSettings();
      return;
    }

    if (
      event.target.closest("#exportHistoryBtn")
    ) {
      exportData();
      return;
    }

    if (
      event.target.closest("#importHistoryBtn")
    ) {
      $("#historyFileInput")?.click();
      return;
    }

    if (
      event.target.closest("#clearHistoryBtn")
    ) {
      if (
        generating ||
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
        "History cleared.",
        "success"
      );

      return;
    }

    if (
      event.target.closest("[data-focus-chat]")
    ) {
      showView("chat");
      return;
    }
  });

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
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        send();
      }
    }
  );

  $("#fileInput")?.addEventListener(
    "change",
    event => {
      addFiles(event.target.files);

      /*
       * Reset input so the same image can
       * be selected again after removal.
       */
      event.target.value = "";
    }
  );

  $("#conversationSearch")?.addEventListener(
    "input",
    event => {
      renderHistory(
        event.target.value
      );
    }
  );

  $("#historyFileInput")?.addEventListener(
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

  $("#voiceBtn")?.addEventListener(
    "click",
    () => {
      toast(
        "Voice input will be enabled in the Voice AI module.",
        "success"
      );
    }
  );

  $("#modelSelect")?.addEventListener(
    "change",
    () => {
      save(
        "ozlind:v3:model",
        $("#modelSelect").value
      );
    }
  );

  $("#modeSelect")?.addEventListener(
    "change",
    event => {
      settings.mode =
        event.target.value;

      save(K.settings, settings);
    }
  );

  window.addEventListener(
    "beforeunload",
    () => {
      if (generating) {
        controller?.abort();
      }
    }
  );

  window.addEventListener(
    "load",
    () => {
      initializeTheme();

      if (!chats.length) {
        newChat();
      } else {
        renderMessages();
        renderHistory();
      }

      loadSettingsUI();
      renderFiles();
      resizeInput();
    }
  );

})();
