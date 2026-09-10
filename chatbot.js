(() => {
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STORAGE = {
  chats: "ozlind_chats_v4",
  settings: "ozlind_settings_v4",
  theme: "ozlind_theme_v4",
  visitor: "ozlind_visitor_v1"
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
    toast("Browser storage is full.", "error");
  }
}

function persist() {
  chats = chats
    .filter(c => c?.id && Array.isArray(c.messages))
    .slice(0, 100);

  save(STORAGE.chats, chats);
}

function uid() {
  return (
    crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/* Anonymous visitor ID.
   This identifies a browser/device session without collecting
   name, email, password or other personal information.
*/
function visitorId() {
  let id = localStorage.getItem(STORAGE.visitor);

  if (!id) {
    id = uid();
    localStorage.setItem(STORAGE.visitor, id);
  }

  return id;
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]
  );
}

function toast(message, type = "") {
  const stack = $("#toastStack");
  if (!stack) return;

  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;

  stack.append(node);

  setTimeout(() => node.remove(), 2800);
}

function current() {
  return chats.find(c => c.id === active);
}

function titleOf(text) {
  let title = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(hi|hello|hey|hai|good morning|good afternoon|good evening)[,!. ]*/i,
      ""
    )
    .replace(
      /^(can you|could you|please|help me|i want to|i need to)\s+/i,
      ""
    )
    .trim();

  if (!title) return "New conversation";

  title = title[0].toUpperCase() + title.slice(1);

  return title.length > 58
    ? title.slice(0, 58).trim() + "…"
    : title;
}

function newChat() {
  const conversation = {
    id: uid(),
    title: "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  chats.unshift(conversation);
  active = conversation.id;

  persist();
  render();
  openPage("chat");

  setTimeout(() => {
    $("#chatInput")?.focus();
  }, 0);
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

  if ($("#topbarTitle")) {
    $("#topbarTitle").textContent =
      titles[view] || "OZLIND";
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

function resize() {
  const input = $("#chatInput");
  if (!input) return;

  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 170) + "px";
}

function render() {
  const conversation = current();
  const box = $("#chatMessages");
  const empty = $("#chatEmpty");

  if (!box || !empty) return;

  box.innerHTML = "";

  if (
    !conversation ||
    !conversation.messages.length
  ) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  conversation.messages.forEach((message, index) => {
    const article = document.createElement("article");

    article.className =
      `message ${message.role}` +
      (message.error ? " error" : "");

    const body = esc(message.content)
      .replace(/\n/g, "<br>");

    const tools =
      message.role === "assistant" && !message.error
        ? `
          <div class="message-tools">
            <button data-copy="${index}">Copy</button>
            <button data-regenerate="${index}">Regenerate</button>
            <button data-delete-message="${index}">Delete</button>
          </div>
        `
        : message.role === "user"
        ? `
          <div class="message-tools">
            <button data-edit="${index}">Edit</button>
            <button data-delete-message="${index}">Delete</button>
          </div>
        `
        : "";

    const images = message.attachments?.length
      ? `
        <div class="message-images">
          ${message.attachments
            .map(
              image =>
                `<img src="${esc(image.dataUrl)}" alt="">`
            )
            .join("")}
        </div>
      `
      : "";

    article.innerHTML = `
      <div class="meta">
        ${message.role === "user" ? "You" : "OZLIND AI"}
      </div>

      <div class="body">
        ${
          body ||
          (!message.error ? "Thinking…" : "")
        }
      </div>

      ${images}
      ${tools}
    `;

    box.append(article);
  });

  requestAnimationFrame(() => {
    const scroll = $("#chatScroll");

    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  });
}

function renderHistory(filter = "") {
  const list = $("#conversationList");

  if (!list) return;

  const query = filter.toLowerCase().trim();

  const rows = chats.filter(conversation =>
    `${conversation.title} ${
      conversation.messages
        .map(message => message.content)
        .join(" ")
    }`
      .toLowerCase()
      .includes(query)
  );

  list.innerHTML = rows.length
    ? rows
        .map(
          conversation => `
            <div class="history-item">
              <div class="history-main">
                <b>${esc(conversation.title)}</b>
                <small>
                  ${conversation.messages.length}
                  message${
                    conversation.messages.length === 1
                      ? ""
                      : "s"
                  }
                </small>
              </div>

              <button data-open="${esc(
                conversation.id
              )}">→</button>

              <button data-delete="${esc(
                conversation.id
              )}">×</button>
            </div>
          `
        )
        .join("")
    : `
      <div class="history-empty">
        <b>No conversations</b>
        <small>
          Your saved conversations will appear here.
        </small>
      </div>
    `;
}

function renderSettings() {
  if ($("#responseLength")) {
    $("#responseLength").value = settings.length;
  }

  if ($("#responseStyle")) {
    $("#responseStyle").value = settings.style;
  }

  if ($("#customInstructions")) {
    $("#customInstructions").value =
      settings.instructions || "";
  }

  if ($("#memoryToggle")) {
    $("#memoryToggle").setAttribute(
      "aria-pressed",
      String(!!settings.memory)
    );
  }
}

function renderAttachments() {
  const container = $("#chatAttachments");

  if (!container) return;

  container.innerHTML = attachments
    .map(
      (file, index) => `
        <div class="attachment">
          <img
            src="${esc(file.dataUrl)}"
            alt=""
          >

          <button
            data-remove="${index}"
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      `
    )
    .join("");

  if ($("#contextIndicator")) {
    $("#contextIndicator").textContent =
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

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function addFiles(files) {
  const selected = [...files]
    .filter(file =>
      file.type.startsWith("image/")
    )
    .slice(0, 4 - attachments.length);

  for (const file of selected) {
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

function requestMessages(conversation) {
  const source = settings.memory
    ? conversation.messages.slice(-20)
    : conversation.messages.slice(-1);

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

function setBusy(value) {
  busy = value;

  $("#sendBtn")?.classList.toggle(
    "hidden",
    value
  );

  $("#stopBtn")?.classList.toggle(
    "hidden",
    !value
  );

  if ($("#connectionStatus")) {
    $("#connectionStatus").innerHTML = value
      ? "<i></i> Thinking…"
      : "<i></i> Ready";
  }
}

async function copyMessage(index) {
  const message = current()?.messages[index];

  if (!message) return;

  try {
    await navigator.clipboard.writeText(
      message.content || ""
    );

    toast("Copied", "ok");
  } catch {
    toast("Copy unavailable.", "error");
  }
}

function deleteMessage(index) {
  const conversation = current();

  if (!conversation) return;

  conversation.messages.splice(index, 1);
  conversation.updatedAt =
    new Date().toISOString();

  persist();
  render();
}

function editMessage(index) {
  const conversation = current();
  const message = conversation?.messages[index];

  if (!message || message.role !== "user") {
    return;
  }

  $("#chatInput").value =
    message.content || "";

  attachments = message.attachments
    ? [...message.attachments]
    : [];

  conversation.messages.splice(index);

  persist();
  renderAttachments();
  resize();
  openPage("chat");

  $("#chatInput").focus();
}

async function regenerate(index) {
  const conversation = current();

  if (
    !conversation ||
    busy ||
    conversation.messages[index]?.role !==
      "assistant"
  ) {
    return;
  }

  const previous =
    conversation.messages[index - 1];

  if (!previous || previous.role !== "user") {
    return;
  }

  conversation.messages.splice(index, 1);

  persist();

  await generate(
    conversation,
    previous
  );
}

async function send() {
  if (busy) return;

  const input = $("#chatInput");
  const text = input?.value.trim() || "";

  if (!text && !attachments.length) {
    return;
  }

  let conversation = current();

  if (!conversation) {
    newChat();
    conversation = current();
  }

  const images = attachments.splice(0, 4);

  renderAttachments();

  conversation.messages.push({
    role: "user",
    content: text,
    attachments: images
  });

  if (conversation.messages.length === 1) {
    conversation.title =
      titleOf(text || "Image analysis");
  }

  conversation.updatedAt =
    new Date().toISOString();

  persist();

  input.value = "";

  resize();
  render();

  await generate(
    conversation,
    conversation.messages[
      conversation.messages.length - 1
    ]
  );
}

async function generate(
  conversation,
  userMessage
) {
  const assistant = {
    role: "assistant",
    content: ""
  };

  conversation.messages.push(assistant);

  setBusy(true);

  controller = new AbortController();

  persist();
  render();

  try {
    const model =
      $("#modelSelect")?.value || "auto";

    const research =
      $("#researchToggle")?.getAttribute(
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
            requestMessages(conversation),

          model,

          research,

          responseLength:
            settings.length,

          responseStyle:
            settings.style,

          memory:
            settings.memory,

          customInstructions:
            settings.instructions,

          /* Supabase analytics */
          visitorId: visitorId(),

          conversationId:
            conversation.id
        })
      }
    );

    if (!response.ok) {
      let message =
        `Request failed (${response.status}).`;

      try {
        const data =
          await response.json();

        if (data?.error) {
          message = data.error;
        }
      } catch {}

      throw Error(message);
    }

    if (!response.body) {
      throw Error(
        "No response returned from OZLIND."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

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
          throw Error(
            data.error ||
              "Generation failed."
          );
        }
      }
    }

    if (!assistant.content.trim()) {
      throw Error(
        "OZLIND returned an empty response."
      );
    }
  } catch (error) {
    if (
      error?.name === "AbortError"
    ) {
      if (!assistant.content.trim()) {
        assistant.content =
          "Generation stopped.";
      } else {
        assistant.content +=
          "\n\nGeneration stopped.";
      }
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
    conversation.updatedAt =
      new Date().toISOString();

    persist();
    render();

    setBusy(false);

    controller = null;
  }
}

function toggleTheme() {
  const next =
    document.body.dataset.theme === "dark"
      ? "light"
      : "dark";

  document.body.dataset.theme = next;

  save(STORAGE.theme, next);

  if ($("#themeToggle")) {
    $("#themeToggle").textContent =
      next === "dark" ? "☾" : "☀";
  }
}

function toggleResearch() {
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
    button.querySelector("em");

  if (label) {
    label.textContent =
      !enabled ? "ON" : "OFF";
  }
}

/* ---------------- EVENTS ---------------- */

document.addEventListener(
  "click",
  async event => {
    const nav =
      event.target.closest(
        "[data-view]"
      );

    if (nav) {
      openPage(nav.dataset.view);
      return;
    }

    const prompt =
      event.target.closest(
        "[data-prompt]"
      );

    if (prompt) {
      openPage("chat");

      $("#chatInput").value =
        prompt.dataset.prompt;

      resize();
      $("#chatInput").focus();

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
        "#mobileNavBtn"
      )
    ) {
      $("#sidebar")?.classList.add(
        "open"
      );

      $("#sidebarOverlay")?.classList.add(
        "open"
      );

      return;
    }

    if (
      event.target.closest(
        "#sidebarOverlay"
      )
    ) {
      $("#sidebar")?.classList.remove(
        "open"
      );

      $("#sidebarOverlay")?.classList.remove(
        "open"
      );

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
        "[data-go-chat]"
      )
    ) {
      openPage("chat");
      return;
    }

    if (
      event.target.closest(
        "#researchToggle"
      )
    ) {
      toggleResearch();
      return;
    }

    const remove =
      event.target.closest(
        "[data-remove]"
      );

    if (remove) {
      attachments.splice(
        Number(remove.dataset.remove),
        1
      );

      renderAttachments();

      return;
    }

    const open =
      event.target.closest(
        "[data-open]"
      );

    if (open) {
      active = open.dataset.open;

      render();
      openPage("chat");

      return;
    }

    const deleteConversation =
      event.target.closest(
        "[data-delete]"
      );

    if (deleteConversation) {
      if (
        confirm(
          "Delete this conversation?"
        )
      ) {
        const id =
          deleteConversation.dataset.delete;

        chats = chats.filter(
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
      await regenerate(
        Number(
          regenerateButton.dataset
            .regenerate
        )
      );

      return;
    }

    if (
      event.target.closest(
        "#memoryToggle"
      )
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
          $("#customInstructions")
            ?.value || ""
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

    if (
      event.target.closest(
        "#exportHistoryBtn"
      )
    ) {
      const link =
        document.createElement("a");

      const url =
        URL.createObjectURL(
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
          )
        );

      link.href = url;
      link.download =
        "ozlind-history.json";

      link.click();

      URL.revokeObjectURL(url);

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
  }
);

/* ---------------- FORM ---------------- */

$("#chatForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();
    send();
  }
);

$("#chatInput")?.addEventListener(
  "input",
  resize
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

$("#fileInput")?.addEventListener(
  "change",
  event => {
    if (event.target.files?.length) {
      addFiles(event.target.files);
    }

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
          throw Error();
        }

        chats = data
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

/* ---------------- INIT ---------------- */

window.addEventListener(
  "load",
  () => {
    const theme =
      load(
        STORAGE.theme,
        "dark"
      );

    document.body.dataset.theme =
      theme === "light"
        ? "light"
        : "dark";

    if ($("#themeToggle")) {
      $("#themeToggle").textContent =
        document.body.dataset.theme ===
        "dark"
          ? "☾"
          : "☀";
    }

    /* Create anonymous analytics ID */
    visitorId();

    if (!chats.length) {
      newChat();
    } else {
      render();
    }

    renderSettings();
    renderAttachments();
    resize();
  }
);

})();
