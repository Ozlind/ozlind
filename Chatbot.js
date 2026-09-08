(() => {
  "use strict";

  const STORAGE_KEY = "ozlind_state_v3";
  const MAX_MESSAGE = 8000;
  const MAX_FILES = 5;
  const MAX_IMAGE_MB = 5;
  const MAX_TEXT_FILE_MB = 1;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const els = {
    messages: $("#messages"),
    composer: $("#composer"),
    input: $("#messageInput"),
    send: $("#sendBtn"),
    stop: $("#stopBtn"),
    typing: $("#typingArea"),
    fileInput: $("#fileInput"),
    attachBtn: $("#attachBtn"),
    attachmentPreview: $("#attachmentPreview"),
    voiceBtn: $("#voiceBtn"),
    counter: $("#charCounter"),
    context: $("#contextIndicator"),
    webResearch: $("#webResearch"),
    memoryToggle: $("#memoryToggle"),
    model: $("#modelSelect"),
    style: $("#responseStyle"),
    customInstructions: $("#customInstructions"),
    saveSettings: $("#saveSettingsBtn"),
    historyList: $("#historyList"),
    favoritesList: $("#favoritesList"),
    globalSearch: $("#globalSearch"),
    sidebar: $("#sidebar"),
    mobileMenu: $("#mobileMenuBtn"),
    toast: $("#toastContainer")
  };

  const defaultState = {
    conversations: [],
    activeId: null,
    attachments: [],
    settings: {
      customInstructions: "",
      memory: true,
      webResearch: false,
      responseStyle: "balanced",
      model: "smart"
    }
  };

  let state = loadState();
  let controller = null;
  let generating = false;
  let recognition = null;

  function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return cloneDefault();
      }

      const parsed = JSON.parse(raw);

      return {
        ...cloneDefault(),
        ...parsed,
        settings: {
          ...defaultState.settings,
          ...(parsed.settings || {})
        }
      };
    } catch {
      return cloneDefault();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch {
      toast(
        "Some chat history could not be saved.",
        true
      );
    }
  }

  function uid() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, error = false) {
    if (!els.toast) return;

    const item = document.createElement("div");
    item.className = `toast${error ? " error" : ""}`;
    item.textContent = message;

    els.toast.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 3200);
  }

  function getActiveConversation() {
    return state.conversations.find(
      (conversation) =>
        conversation.id === state.activeId
    );
  }

  function createConversation() {
    const conversation = {
      id: uid(),
      title: "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
      messages: []
    };

    state.conversations.unshift(conversation);
    state.activeId = conversation.id;

    saveState();

    return conversation;
  }

  function ensureConversation() {
    return (
      getActiveConversation() ||
      createConversation()
    );
  }

  function makeTitle(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      return "New conversation";
    }

    return clean.length > 55
      ? clean.slice(0, 55) + "…"
      : clean;
  }

  function newChat() {
    state.attachments = [];
    createConversation();

    renderMessages();
    renderAttachmentPreview();
    renderHistory();

    showPage("chat");

    setTimeout(() => {
      els.input?.focus();
    }, 100);
  }

  function clearCurrentChat() {
    const conversation =
      getActiveConversation();

    if (
      !conversation ||
      !conversation.messages.length
    ) {
      toast("Nothing to clear.");
      return;
    }

    conversation.messages = [];
    conversation.title = "New conversation";
    conversation.updatedAt = Date.now();

    saveState();

    renderMessages();
    renderHistory();
    updateContext();

    toast("Conversation cleared.");
  }

  function renderMessages() {
    const conversation =
      getActiveConversation();

    els.messages.innerHTML = "";

    if (
      !conversation ||
      conversation.messages.length === 0
    ) {
      els.messages.appendChild(
        createEmptyChat()
      );

      updateContext();
      return;
    }

    conversation.messages.forEach(
      (message, index) => {
        els.messages.appendChild(
          renderMessage(message, index)
        );
      }
    );

    updateContext();
    scrollToBottom();
  }

  function createEmptyChat() {
    const wrapper =
      document.createElement("div");

    wrapper.className = "empty-chat";

    wrapper.innerHTML = `
      <div class="empty-orb">
        <span>✦</span>
      </div>

      <h2>Start a new conversation</h2>

      <p>
        Ask a question, upload an image,
        paste code, or simply say hello.
      </p>

      <div class="suggestions">
        <button data-suggestion="Explain something to me simply">
          Explain something
        </button>

        <button data-suggestion="Help me build a website">
          Build a website
        </button>

        <button data-suggestion="Give me creative ideas">
          Creative ideas
        </button>

        <button data-suggestion="Research the latest information about AI">
          Research something
        </button>
      </div>
    `;

    return wrapper;
  }

  function renderMessage(message, index) {
    const wrapper =
      document.createElement("article");

    wrapper.className =
      `message ${message.role}`;

    const avatar =
      document.createElement("div");

    avatar.className = "message-avatar";
    avatar.textContent =
      message.role === "assistant"
        ? "✦"
        : "A";

    const content =
      document.createElement("div");

    content.className = "message-content";

    const bubble =
      document.createElement("div");

    bubble.className = "message-bubble";

    if (message.role === "assistant") {
      bubble.innerHTML =
        markdown(message.content || "");

      if (
        !message.content &&
        message.streaming
      ) {
        bubble.innerHTML = `
          <span class="stream-cursor">▌</span>
        `;
      }
    } else {
      bubble.innerHTML = `
        <p>
          ${escapeHTML(
            message.content || ""
          ).replace(/\n/g, "<br>")}
        </p>
      `;
    }

    if (message.images?.length) {
      message.images.forEach((src) => {
        const image =
          document.createElement("img");

        image.className = "message-image";
        image.src = src;
        image.alt = "Uploaded image";
        image.loading = "lazy";

        bubble.appendChild(image);
      });
    }

    if (message.attachments?.length) {
      const attachmentBox =
        document.createElement("div");

      attachmentBox.className =
        "attachments";

      message.attachments.forEach(
        (file) => {
          const chip =
            document.createElement("div");

          chip.className =
            "attachment-chip";

          chip.textContent =
            file.name || "Attachment";

          attachmentBox.appendChild(chip);
        }
      );

      bubble.appendChild(
        attachmentBox
      );
    }

    content.appendChild(bubble);

    if (
      message.sources?.length &&
      !message.streaming
    ) {
      const sources =
        document.createElement("div");

      sources.className = "sources";

      message.sources
        .slice(0, 6)
        .forEach((source) => {
          if (!source?.url) return;

          const link =
            document.createElement("a");

          link.className =
            "source-item";

          link.href = source.url;
          link.target = "_blank";
          link.rel =
            "noopener noreferrer";

          link.textContent =
            source.title ||
            source.url;

          sources.appendChild(link);
        });

      if (sources.children.length) {
        content.appendChild(sources);
      }
    }

    if (!message.streaming) {
      const actions =
        document.createElement("div");

      actions.className =
        "message-actions";

      if (message.role === "assistant") {
        actions.innerHTML = `
          <button
            class="message-action"
            data-action="copy"
            data-index="${index}"
          >
            Copy
          </button>

          <button
            class="message-action"
            data-action="regenerate"
            data-index="${index}"
          >
            Regenerate
          </button>

          <button
            class="message-action"
            data-action="speak"
            data-index="${index}"
          >
            Read
          </button>

          <button
            class="message-action"
            data-action="like"
            data-index="${index}"
          >
            👍
          </button>

          <button
            class="message-action"
            data-action="dislike"
            data-index="${index}"
          >
            👎
          </button>
        `;
      } else {
        actions.innerHTML = `
          <button
            class="message-action"
            data-action="copy"
            data-index="${index}"
          >
            Copy
          </button>

          <button
            class="message-action"
            data-action="edit"
            data-index="${index}"
          >
            Edit
          </button>

          <button
            class="message-action"
            data-action="delete"
            data-index="${index}"
          >
            Delete
          </button>
        `;
      }

      content.appendChild(actions);
    }

    if (message.role === "assistant") {
      wrapper.appendChild(avatar);
      wrapper.appendChild(content);
    } else {
      wrapper.appendChild(content);
      wrapper.appendChild(avatar);
    }

    return wrapper;
  }

  function markdown(text) {
    let html = escapeHTML(text);

    const blocks = [];

    html = html.replace(
      /```([a-zA-Z0-9_+#.-]*)\n?([\s\S]*?)```/g,
      (_, language, code) => {
        const index = blocks.length;

        blocks.push({
          language:
            language || "code",
          code
        });

        return `___OZLIND_CODE_${index}___`;
      }
    );

    html = html
      .replace(
        /^### (.*)$/gm,
        "<h3>$1</h3>"
      )
      .replace(
        /^## (.*)$/gm,
        "<h2>$1</h2>"
      )
      .replace(
        /^# (.*)$/gm,
        "<h1>$1</h1>"
      )
      .replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      )
      .replace(
        /__(.*?)__/g,
        "<strong>$1</strong>"
      )
      .replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
      )
      .replace(
        /^> (.*)$/gm,
        "<blockquote>$1</blockquote>"
      )
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

    const lines =
      html.split("\n");

    let output = [];
    let inList = false;

    for (const line of lines) {
      const unordered =
        /^\s*[-*]\s+(.*)$/.exec(line);

      const ordered =
        /^\s*\d+\.\s+(.*)$/.exec(line);

      if (unordered || ordered) {
        if (!inList) {
          output.push("<ul>");
          inList = true;
        }

        output.push(
          `<li>${unordered?.[1] || ordered?.[1]}</li>`
        );

        continue;
      }

      if (inList) {
        output.push("</ul>");
        inList = false;
      }

      output.push(line);
    }

    if (inList) {
      output.push("</ul>");
    }

    html = output
      .join("\n")
      .split(/\n{2,}/)
      .map((part) => {
        const trimmed =
          part.trim();

        if (!trimmed) return "";

        if (
          trimmed.startsWith("<h1>") ||
          trimmed.startsWith("<h2>") ||
          trimmed.startsWith("<h3>") ||
          trimmed.startsWith("<ul>") ||
          trimmed.startsWith("<blockquote>") ||
          trimmed.includes("___OZLIND_CODE_")
        ) {
          return trimmed;
        }

        return `
          <p>
            ${trimmed.replace(
              /\n/g,
              "<br>"
            )}
          </p>
        `;
      })
      .join("");

    blocks.forEach(
      (block, index) => {
        const safeCode =
          escapeHTML(block.code);

        const replacement = `
          <div class="code-wrap">
            <div class="code-head">
              <span>
                ${escapeHTML(
                  block.language
                )}
              </span>

              <button
                class="code-copy"
                data-code="${escapeHTML(
                  block.code
                )}"
              >
                Copy
              </button>
            </div>

            <pre><code>${safeCode}</code></pre>
          </div>
        `;

        html = html.replace(
          `___OZLIND_CODE_${index}___`,
          replacement
        );
      }
    );

    return html;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.messages.scrollTop =
        els.messages.scrollHeight;
    });
  }

  function updateContext() {
    const conversation =
      getActiveConversation();

    if (!conversation) {
      els.context.textContent =
        "Context 0%";
      return;
    }

    const total =
      conversation.messages.reduce(
        (sum, message) =>
          sum +
          String(
            message.content || ""
          ).length,
        0
      );

    const percent = Math.min(
      99,
      Math.round(
        (total / 50000) * 100
      )
    );

    els.context.textContent =
      `Context ${percent}%`;
  }

  function updateCounter() {
    if (!els.counter) return;

    els.counter.textContent =
      `${els.input.value.length} / ${MAX_MESSAGE}`;
  }

  function resizeTextarea() {
    if (!els.input) return;

    els.input.style.height = "auto";

    els.input.style.height =
      `${Math.min(
        150,
        els.input.scrollHeight
      )}px`;
  }

  async function sendMessage(
    suppliedText = null
  ) {
    if (generating) return;

    const text = (
      suppliedText ??
      els.input.value
    ).trim();

    if (
      !text &&
      !state.attachments.length
    ) {
      return;
    }

    if (text.length > MAX_MESSAGE) {
      toast(
        "Message is too long.",
        true
      );
      return;
    }

    const conversation =
      ensureConversation();

    const attachments =
      state.attachments;

    const userMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),

      attachments:
        attachments.map((file) => ({
          name: file.name,
          type: file.type,
          kind: file.kind
        })),

      images:
        attachments
          .filter(
            (file) =>
              file.kind === "image"
          )
          .map(
            (file) => file.data
          )
    };

    conversation.messages.push(
      userMessage
    );

    if (
      conversation.title ===
        "New conversation" &&
      text
    ) {
      conversation.title =
        makeTitle(text);
    }

    conversation.updatedAt =
      Date.now();

    state.attachments = [];

    els.input.value = "";

    updateCounter();
    resizeTextarea();
    renderAttachmentPreview();

    saveState();
    renderMessages();
    renderHistory();

    await requestAI(conversation);
  }

  async function requestAI(
    conversation
  ) {
    generating = true;
    controller =
      new AbortController();

    setGeneratingUI(true);

    const assistant = {
      id: uid(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      sources: [],
      streaming: true
    };

    conversation.messages.push(
      assistant
    );

    const assistantIndex =
      conversation.messages.length - 1;

    renderMessages();

    try {
      const history =
        conversation.messages
          .slice(0, assistantIndex)
          .map((message) => ({
            role: message.role,
            content:
              message.content || "",
            attachments:
              message.images?.length
                ? message.images
                : []
          }));

      const payload = {
        messages: history,

        options: {
          webResearch:
            Boolean(
              els.webResearch.checked
            ),

          responseStyle:
            els.style.value,

          model:
            els.model.value,

          memory:
            Boolean(
              els.memoryToggle.checked
            ),

          customInstructions:
            state.settings
              .customInstructions
        }
      };

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
              JSON.stringify(payload),

            signal:
              controller.signal
          }
        );

      if (!response.ok) {
        let message =
          "Something went wrong.";

        try {
          const data =
            await response.json();

          if (data?.error) {
            message =
              data.error;
          }
        } catch {}

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "Streaming is unavailable."
        );
      }

      await consumeStream(
        response.body,
        async (event) => {
          if (
            event.type ===
            "token"
          ) {
            assistant.content +=
              event.data || "";

            renderMessages();
          }

          if (
            event.type ===
            "sources"
          ) {
            assistant.sources =
              Array.isArray(
                event.data
              )
                ? event.data
                : [];

            renderMessages();
          }

          if (
            event.type ===
            "done"
          ) {
            assistant.streaming =
              false;

            conversation.updatedAt =
              Date.now();

            saveState();
            renderMessages();
            renderHistory();
          }

          if (
            event.type ===
            "error"
          ) {
            throw new Error(
              String(
                event.data ||
                "Generation failed."
              )
            );
          }
        }
      );

      assistant.streaming = false;

      saveState();
      renderMessages();
      renderHistory();
    } catch (error) {
      assistant.streaming = false;

      if (
        error.name ===
        "AbortError"
      ) {
        if (
          !assistant.content.trim()
        ) {
          conversation.messages.pop();
        }

        saveState();
        renderMessages();

        return;
      }

      if (
        !assistant.content.trim()
      ) {
        assistant.content =
          "I couldn't complete that request.";
      }

      saveState();
      renderMessages();

      toast(
        error.message ||
          "Request failed.",
        true
      );
    } finally {
      generating = false;
      controller = null;

      setGeneratingUI(false);
      updateContext();
    }
  }

  async function consumeStream(
    stream,
    onEvent
  ) {
    const reader =
      stream.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

    try {
      while (true) {
        const {
          value,
          done
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          {
            stream: true
          }
        );

        const chunks =
          buffer.split("\n\n");

        buffer =
          chunks.pop() || "";

        for (const chunk of chunks) {
          await parseSSEChunk(
            chunk,
            onEvent
          );
        }
      }

      if (buffer.trim()) {
        await parseSSEChunk(
          buffer,
          onEvent
        );
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  async function parseSSEChunk(
    chunk,
    onEvent
  ) {
    let eventName =
      "message";

    let data = "";

    chunk
      .split("\n")
      .forEach((line) => {
        if (
          line.startsWith(
            "event:"
          )
        ) {
          eventName =
            line
              .slice(6)
              .trim();
        }

        if (
          line.startsWith(
            "data:"
          )
        ) {
          data +=
            line
              .slice(5)
              .trim();
        }
      });

    if (!data) return;

    let parsed = data;

    try {
      parsed =
        JSON.parse(data);
    } catch {}

    await onEvent({
      type: eventName,
      data: parsed
    });
  }

  function setGeneratingUI(
    active
  ) {
    if (!els.send) return;

    els.send.hidden = active;
    els.stop.hidden = !active;
    els.typing.hidden = !active;

    els.input.disabled = active;
    els.attachBtn.disabled =
      active;
    els.voiceBtn.disabled =
      active;

    if (active) {
      scrollToBottom();
    }
  }

  function stopGeneration() {
    if (!controller) return;

    controller.abort();

    toast(
      "Generation stopped."
    );
  }

  function renderAttachmentPreview() {
    if (!els.attachmentPreview)
      return;

    els.attachmentPreview.innerHTML =
      "";

    state.attachments.forEach(
      (file, index) => {
        const chip =
          document.createElement(
            "div"
          );

        chip.className =
          "preview-chip";

        const name =
          document.createElement(
            "span"
          );

        name.textContent =
          file.name;

        const remove =
          document.createElement(
            "button"
          );

        remove.type = "button";
        remove.className =
          "preview-remove";
        remove.textContent = "×";

        remove.addEventListener(
          "click",
          () => {
            state.attachments.splice(
              index,
              1
            );

            renderAttachmentPreview();
          }
        );

        chip.appendChild(name);
        chip.appendChild(remove);

        els.attachmentPreview.appendChild(
          chip
        );
      }
    );
  }

  async function handleFiles(
    fileList
  ) {
    const files = [
      ...fileList
    ];

    if (
      state.attachments.length +
        files.length >
      MAX_FILES
    ) {
      toast(
        `Maximum ${MAX_FILES} files.`,
        true
      );

      return;
    }

    for (const file of files) {
      const image =
        file.type.startsWith(
          "image/"
        );

      const maxMB = image
        ? MAX_IMAGE_MB
        : MAX_TEXT_FILE_MB;

      if (
        file.size >
        maxMB * 1024 * 1024
      ) {
        toast(
          `${file.name} is too large.`,
          true
        );

        continue;
      }

      if (image) {
        try {
          const data =
            await readDataURL(
              file
            );

          state.attachments.push({
            name: file.name,
            type: file.type,
            kind: "image",
            data
          });
        } catch {
          toast(
            `Could not read ${file.name}.`,
            true
          );
        }

        continue;
      }

      const allowed =
        /\.(txt|md|json|csv|js|ts|html|css)$/i.test(
          file.name
        );

      if (!allowed) {
        toast(
          `${file.name} is not supported.`,
          true
        );

        continue;
      }

      try {
        const text =
          await file.text();

        state.attachments.push({
          name: file.name,
          type:
            file.type ||
            "text/plain",
          kind: "text",
          data:
            text.slice(
              0,
              12000
            )
        });
      } catch {
        toast(
          `Could not read ${file.name}.`,
          true
        );
      }
    }

    renderAttachmentPreview();
  }

  function readDataURL(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload =
          () =>
            resolve(
              reader.result
            );

        reader.onerror =
          reject;

        reader.readAsDataURL(
          file
        );
      }
    );
  }

  function renderHistory(
    search = ""
  ) {
    if (
      !els.historyList ||
      !els.favoritesList
    ) {
      return;
    }

    const query =
      String(search || "")
        .toLowerCase()
        .trim();

    const conversations =
      [...state.conversations]
        .sort(
          (a, b) =>
            b.updatedAt -
            a.updatedAt
        )
        .filter(
          (conversation) => {
            if (!query)
              return true;

            const title =
              conversation.title
                .toLowerCase();

            const content =
              conversation.messages
                .some(
                  (message) =>
                    String(
                      message.content ||
                        ""
                    )
                      .toLowerCase()
                      .includes(query)
                );

            return (
              title.includes(query) ||
              content
            );
          }
        );

    renderConversationList(
      els.historyList,
      conversations
    );

    renderConversationList(
      els.favoritesList,
      conversations.filter(
        (item) =>
          item.favorite
      )
    );
  }

  function renderConversationList(
    container,
    conversations
  ) {
    container.innerHTML = "";

    if (!conversations.length) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "history-item";

      empty.textContent =
        "No conversations found.";

      container.appendChild(
        empty
      );

      return;
    }

    conversations
      .slice(0, 30)
      .forEach(
        (conversation) => {
          const item =
            document.createElement(
              "div"
            );

          item.className =
            "history-item";

          item.innerHTML = `
            <div class="profile-avatar">
              ✦
            </div>

            <div class="history-item-main">
              <div class="history-item-title"></div>
              <div class="history-item-date"></div>
            </div>

            <button
              class="message-action favorite-toggle"
              type="button"
            >
              ${
                conversation.favorite
                  ? "★"
                  : "☆"
              }
            </button>
          `;

          item.querySelector(
            ".history-item-title"
          ).textContent =
            conversation.title;

          item.querySelector(
            ".history-item-date"
          ).textContent =
            formatDate(
              conversation.updatedAt
            );

          item.addEventListener(
            "click",
            (event) => {
              if (
                event.target.closest(
                  ".favorite-toggle"
                )
              ) {
                return;
              }

              state.activeId =
                conversation.id;

              saveState();

              showPage("chat");
              renderMessages();
            }
          );

          item
            .querySelector(
              ".favorite-toggle"
            )
            .addEventListener(
              "click",
              (event) => {
                event.stopPropagation();

                conversation.favorite =
                  !conversation.favorite;

                saveState();

                renderHistory(
                  els.globalSearch.value
                );
              }
            );

          container.appendChild(
            item
          );
        }
      );
  }

  function formatDate(timestamp) {
    try {
      return new Date(
        timestamp
      ).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric"
        }
      );
    } catch {
      return "";
    }
  }

  function showPage(page) {
    $$(".page").forEach(
      (item) => {
        item.classList.remove(
          "active-page"
        );
      }
    );

    const target =
      $(`#page-${page}`);

    if (target) {
      target.classList.add(
        "active-page"
      );
    }

    $$(".nav-item").forEach(
      (item) => {
        item.classList.toggle(
          "active",
          item.dataset.page ===
            page
        );
      }
    );

    $$(".mobile-nav button[data-page]")
      .forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.page ===
            page
        );
      });

    if (
      page === "history" ||
      page === "favorites"
    ) {
      renderHistory(
        els.globalSearch.value
      );
    }

    if (page === "settings") {
      els.customInstructions.value =
        state.settings
          .customInstructions ||
        "";
    }

    els.sidebar.classList.remove(
      "open"
    );
  }

  function editMessage(index) {
    if (generating) return;

    const conversation =
      getActiveConversation();

    if (!conversation) return;

    const message =
      conversation.messages[
        index
      ];

    if (
      !message ||
      message.role !== "user"
    ) {
      return;
    }

    conversation.messages =
      conversation.messages.slice(
        0,
        index
      );

    state.attachments = [];

    els.input.value =
      message.content || "";

    updateCounter();
    resizeTextarea();
    renderAttachmentPreview();

    saveState();
    renderMessages();

    els.input.focus();
  }

  async function regenerate(index) {
    if (generating) return;

    const conversation =
      getActiveConversation();

    if (!conversation) return;

    const assistant =
      conversation.messages[
        index
      ];

    if (
      !assistant ||
      assistant.role !== "assistant"
    ) {
      return;
    }

    const userIndex =
      index - 1;

    if (
      userIndex < 0 ||
      conversation.messages[
        userIndex
      ].role !== "user"
    ) {
      toast(
        "Cannot regenerate this response.",
        true
      );

      return;
    }

    conversation.messages =
      conversation.messages.slice(
        0,
        index
      );

    conversation.updatedAt =
      Date.now();

    saveState();
    renderMessages();

    await requestAI(
      conversation
    );
  }

  function deleteMessage(index) {
    if (generating) return;

    const conversation =
      getActiveConversation();

    if (!conversation) return;

    conversation.messages.splice(
      index,
      1
    );

    conversation.updatedAt =
      Date.now();

    saveState();

    renderMessages();
    renderHistory();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      toast("Copied.");
    } catch {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = text;

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      toast("Copied.");
    }
  }

  function speak(text) {
    if (
      !("speechSynthesis" in window)
    ) {
      toast(
        "Read aloud is not supported.",
        true
      );

      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        String(text || "")
          .replace(/[`*_#]/g, "")
      );

    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function startVoice() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      toast(
        "Voice input is not supported.",
        true
      );

      return;
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      return;
    }

    recognition =
      new Recognition();

    recognition.lang =
      "en-US";

    recognition.interimResults =
      true;

    recognition.continuous =
      false;

    recognition.onstart = () => {
      els.voiceBtn.textContent =
        "●";

      toast("Listening...");
    };

    recognition.onresult =
      (event) => {
        let text = "";

        for (
          const result of
          event.results
        ) {
          text +=
            result[0]
              .transcript;
        }

        els.input.value =
          text.slice(
            0,
            MAX_MESSAGE
          );

        updateCounter();
        resizeTextarea();
      };

    recognition.onerror =
      () => {
        toast(
          "Voice input failed.",
          true
        );
      };

    recognition.onend = () => {
      els.voiceBtn.textContent =
        "🎙";

      recognition = null;
    };

    recognition.start();
  }

  function saveSettings() {
    state.settings.customInstructions =
      els.customInstructions.value.trim();

    saveState();

    toast(
      "Settings saved."
    );
  }

  function applySettings() {
    els.webResearch.checked =
      Boolean(
        state.settings
          .webResearch
      );

    els.memoryToggle.checked =
      Boolean(
        state.settings.memory
      );

    els.style.value =
      state.settings
        .responseStyle ||
      "balanced";

    els.model.value =
      state.settings.model ||
      "smart";

    els.customInstructions.value =
      state.settings
        .customInstructions ||
      "";
  }

  /* NAVIGATION */

  $$(".nav-item, .mobile-nav button[data-page]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          showPage(
            button.dataset.page
          );
        }
      );
    });

  $$(".feature-card").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          showPage(
            button.dataset.page
          );
        }
      );
    }
  );

  $("#heroStartBtn")
    ?.addEventListener(
      "click",
      () => {
        showPage("chat");
        els.input.focus();
      }
    );

  $("#heroExploreBtn")
    ?.addEventListener(
      "click",
      () => {
        document
          .querySelector(
            ".feature-grid"
          )
          ?.scrollIntoView({
            behavior:
              "smooth"
          });
      }
    );

  $("#newChatBtn")
    ?.addEventListener(
      "click",
      newChat
    );

  $("#mobileNewChat")
    ?.addEventListener(
      "click",
      newChat
    );

  $("#clearChatBtn")
    ?.addEventListener(
      "click",
      clearCurrentChat
    );

  els.mobileMenu
    ?.addEventListener(
      "click",
      () => {
        els.sidebar.classList.toggle(
          "open"
        );
      }
    );

  els.attachBtn
    ?.addEventListener(
      "click",
      () => {
        els.fileInput.click();
      }
    );

  els.fileInput
    ?.addEventListener(
      "change",
      async () => {
        await handleFiles(
          els.fileInput.files
        );

        els.fileInput.value =
          "";
      }
    );

  els.voiceBtn
    ?.addEventListener(
      "click",
      startVoice
    );

  els.stop
    ?.addEventListener(
      "click",
      stopGeneration
    );

  els.composer
    ?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        sendMessage();
      }
    );

  els.input
    ?.addEventListener(
      "input",
      () => {
        updateCounter();
        resizeTextarea();
      }
    );

  els.input
    ?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          sendMessage();
        }
      }
    );

  els.globalSearch
    ?.addEventListener(
      "input",
      () => {
        renderHistory(
          els.globalSearch.value
        );
      }
    );

  els.webResearch
    ?.addEventListener(
      "change",
      () => {
        state.settings.webResearch =
          els.webResearch.checked;

        saveState();
      }
    );

  els.memoryToggle
    ?.addEventListener(
      "change",
      () => {
        state.settings.memory =
          els.memoryToggle.checked;

        saveState();
      }
    );

  els.style
    ?.addEventListener(
      "change",
      () => {
        state.settings.responseStyle =
          els.style.value;

        saveState();
      }
    );

  els.model
    ?.addEventListener(
      "change",
      () => {
        state.settings.model =
          els.model.value;

        saveState();
      }
    );

  els.saveSettings
    ?.addEventListener(
      "click",
      saveSettings
    );

  /* GLOBAL CLICK ACTIONS */

  document.addEventListener(
    "click",
    async (event) => {
      const suggestion =
        event.target.closest(
          "[data-suggestion]"
        );

      if (suggestion) {
        showPage("chat");

        await sendMessage(
          suggestion.dataset
            .suggestion
        );

        return;
      }

      const codeCopy =
        event.target.closest(
          ".code-copy"
        );

      if (codeCopy) {
        await copyText(
          codeCopy.dataset.code ||
            ""
        );

        return;
      }

      const action =
        event.target.closest(
          ".message-action"
        );

      if (!action) return;

      const conversation =
        getActiveConversation();

      if (!conversation) return;

      const index =
        Number(
          action.dataset.index
        );

      const type =
        action.dataset.action;

      const message =
        conversation.messages[
          index
        ];

      if (!message) return;

      if (type === "copy") {
        await copyText(
          message.content || ""
        );
      }

      if (type === "edit") {
        editMessage(index);
      }

      if (type === "delete") {
        deleteMessage(index);
      }

      if (type === "regenerate") {
        await regenerate(index);
      }

      if (type === "speak") {
        speak(
          message.content || ""
        );
      }

      if (type === "like") {
        message.feedback =
          "positive";

        saveState();

        toast(
          "Thanks for the feedback."
        );
      }

      if (type === "dislike") {
        message.feedback =
          "negative";

        saveState();

        toast(
          "Feedback recorded."
        );
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "k"
      ) {
        event.preventDefault();

        els.globalSearch?.focus();
      }

      if (
        event.key === "Escape" &&
        generating
      ) {
        stopGeneration();
      }
    }
  );

  /* INIT */

  if (!state.conversations.length) {
    createConversation();
  }

  applySettings();
  renderMessages();
  renderHistory();
  renderAttachmentPreview();
  updateCounter();
  resizeTextarea();
})();
