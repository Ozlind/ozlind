"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MODES = [
  ["auto", "Auto", "Adaptive"],
  ["fast", "Fast", "Quick answers"],
  ["pro", "Pro", "Deep thinking"],
  ["vision", "Vision", "Images & files"],
  ["research", "Research", "Current web"],
  ["image", "Create", "Image generation"],
];

const CONVERSATIONS_KEY = "ozlind.conversations.v5";
const SETTINGS_KEY = "ozlind.settings.v5";
const MAX_HISTORY = 40;
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const NAV = [
  ["chat", "AI Chat", "LIVE"],
  ["research", "Web Research", "LIVE"],
  ["image", "Image Studio", "LIVE"],
  ["edit", "Photo Editor", "NEXT"],
  ["code", "Code Assistant", "NEXT"],
  ["docs", "Documents", "NEXT"],
  ["voice", "Voice AI", "NEXT"],
];

function uid() {
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function titleOf(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();

  return value.length > 46
    ? `${value.slice(0, 46).trim()}…`
    : value || "New conversation";
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),

    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),

    chat: (
      <>
        <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6a3.5 3.5 0 0 1-3.5 3.5H12l-4.2 3v-3.1A3.5 3.5 0 0 1 5 12.5z" />
      </>
    ),

    research: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4M8.5 11h5M11 8.5v5" />
      </>
    ),

    sparkle: (
      <>
        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
      </>
    ),

    edit: (
      <>
        <path d="m4 16.5-.8 4.3 4.3-.8L18.7 9a2.8 2.8 0 0 0-4-4z" />
        <path d="m13.5 6.5 4 4" />
      </>
    ),

    code: (
      <>
        <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />
      </>
    ),

    docs: (
      <>
        <path d="M6 3.5h8l4 4v13H6z" />
        <path d="M14 3.5v4h4M9 12h6M9 16h6" />
      </>
    ),

    voice: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),

    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 1.6-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.6-1.6.1-.1A1.7 1.7 0 0 0 8.6 15a1.7 1.7 0 0 0-1.5-1H7v-2.3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.6-1.6.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.6 1.6-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),

    copy: (
      <>
        <rect x="8" y="8" width="11" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
      </>
    ),

    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M19 12a7 7 0 1 0 1.2 4" />
      </>
    ),

    trash: (
      <>
        <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </>
    ),

    x: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h13M13 7l5 5-5 5" />
      </>
    ),

    paperclip: (
      <>
        <path d="m8.5 12.5 5.9-5.9a3.1 3.1 0 1 1 4.4 4.4l-7.7 7.7a4.5 4.5 0 0 1-6.4-6.4l7.2-7.2" />
      </>
    ),

    chevron: <path d="m6 9 6 6 6-6" />,

    download: (
      <>
        <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
      </>
    ),

    stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  };

  return <svg {...common}>{paths[name] || paths.sparkle}</svg>;
}

function Inline({ text }) {
  const source = String(text || "");

  const tokenPattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

  return source.split(tokenPattern).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = part.match(
      /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/
    );

    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
        >
          {link[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function Markdown({ content }) {
  const blocks = String(content || "").split(/```/);

  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.replace(/^\w+\n/, "");

          return (
            <pre className="code-block" key={index}>
              <code>{lines.trimEnd()}</code>
            </pre>
          );
        }

        return block
          .split(/\n{2,}/)
          .filter((value) => value.trim())
          .map((paragraph, paragraphIndex) => (
            <div
              className="md-block"
              key={`${index}-${paragraphIndex}`}
            >
              {paragraph
                .split("\n")
                .filter(Boolean)
                .map((line, lineIndex) => {
                  const heading = line.match(
                    /^(#{1,3})\s+(.+)$/
                  );

                  if (heading) {
                    return (
                      <h3 key={lineIndex}>
                        {heading[2]}
                      </h3>
                    );
                  }

                  if (/^[-*]\s+/.test(line)) {
                    return (
                      <div
                        className="md-list"
                        key={lineIndex}
                      >
                        <span>•</span>
                        <Inline
                          text={line.replace(
                            /^[-*]\s+/,
                            ""
                          )}
                        />
                      </div>
                    );
                  }

                  if (/^\d+\.\s+/.test(line)) {
                    return (
                      <div
                        className="md-list"
                        key={lineIndex}
                      >
                        <span>
                          {line.match(/^\d+/)[0]}.
                        </span>
                        <Inline
                          text={line.replace(
                            /^\d+\.\s+/,
                            ""
                          )}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={lineIndex}>
                      <Inline text={line} />
                    </div>
                  );
                })}
            </div>
          ));
      })}
    </div>
  );
}

async function fileToAttachment(file) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `${file.name} is not supported yet.`
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `${file.name} is larger than 8 MB.`
    );
  }

  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(
        String(reader.result).split(",")[1] || ""
      );
    };

    reader.onerror = () => {
      reject(
        new Error(
          `Could not read ${file.name}.`
        )
      );
    };

    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    mimeType: file.type,
    data,
  };
}

function faviconFor(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domain
  )}&sz=64`;
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [memory, setMemory] = useState(true);
  const [notice, setNotice] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [copied, setCopied] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const persistTimer = useRef(null);
  const chatsRef = useRef(chats);
  const activeRef = useRef(active);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(
          CONVERSATIONS_KEY
        ) || "[]"
      );

      const settings = JSON.parse(
        localStorage.getItem(
          SETTINGS_KEY
        ) || "{}"
      );

      const loaded = Array.isArray(stored)
        ? stored.slice(-MAX_HISTORY)
        : [];

      setChats(loaded);

      setCustom(
        typeof settings.custom === "string"
          ? settings.custom
          : ""
      );

      setMemory(settings.memory !== false);

      if (loaded.length) {
        setActive(
          loaded[loaded.length - 1].id
        );
      }
    } catch {
      setChats([]);
    }
  }, []);

  useEffect(() => {
    clearTimeout(persistTimer.current);

    persistTimer.current = setTimeout(() => {
      try {
        const safe = chats
          .slice(-MAX_HISTORY)
          .map((chat) => ({
            ...chat,
            messages: (chat.messages || []).map(
              ({ image, ...message }) =>
                message
            ),
          }));

        localStorage.setItem(
          CONVERSATIONS_KEY,
          JSON.stringify(safe)
        );
      } catch {
        setNotice(
          "Conversation storage is unavailable on this device."
        );
      }
    }, 300);

    return () =>
      clearTimeout(persistTimer.current);
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          custom: custom.slice(0, 3000),
          memory,
        })
      );
    } catch {}
  }, [custom, memory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [active, busy]);

  useEffect(() => {
    const onKey = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        document
          .querySelector("[data-search]")
          ?.focus();
      }

      if (
        event.key.toLowerCase() === "n" &&
        !["INPUT", "TEXTAREA"].includes(
          document.activeElement?.tagName
        )
      ) {
        event.preventDefault();
        newChat();
      }

      if (event.key === "Escape") {
        setMobile(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      onKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );
  }, []);

  useEffect(() => {
    const node = textareaRef.current;

    if (!node) return;

    node.style.height = "auto";

    node.style.height = `${Math.min(
      node.scrollHeight,
      180
    )}px`;
  }, [input]);

  const current = useMemo(
    () =>
      chats.find(
        (chat) => chat.id === active
      ) || null,
    [chats, active]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter(
      (chat) =>
        !query ||
        chat.title
          .toLowerCase()
          .includes(query)
    );
  }, [chats, search]);

  const activeMode =
    MODES.find(([id]) => id === mode) ||
    MODES[0];

  function updateChat(id, updater) {
    setChats((items) =>
      items.map((chat) =>
        chat.id === id
          ? updater(chat)
          : chat
      )
    );
  }

  function newChat() {
    if (busy) {
      stop();
    }

    const chat = {
      id: uid(),
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setChats((items) => [
      ...items,
      chat,
    ]);

    setActive(chat.id);
    setInput("");
    setAttachments([]);
    setNotice("");
    setMobile(false);
  }

  function clearChat() {
    if (!current) return;

    updateChat(current.id, (chat) => ({
      ...chat,
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    }));

    setInput("");
    setAttachments([]);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;

    setBusy(false);

    const chatId = activeRef.current;

    if (chatId) {
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map(
          (message) =>
            message.streaming
              ? {
                  ...message,
                  streaming: false,
                }
              : message
        ),
      }));
    }
  }

  async function copyMessage(id, content) {
    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopied(id);

      setTimeout(
        () => setCopied(""),
        1200
      );
    } catch {
      setNotice(
        "Copy is unavailable in this browser."
      );
    }
  }

  function removeMessage(id) {
    if (!current) return;

    updateChat(current.id, (chat) => ({
      ...chat,
      messages: chat.messages.filter(
        (message) =>
          message.id !== id
      ),
      updatedAt: Date.now(),
    }));
  }

  function editMessage(message) {
    setInput(message.content || "");
    setAttachments([]);
    setTimeout(
      () => textareaRef.current?.focus(),
      0
    );
  }

  function regenerate(index) {
    if (!current || busy) return;

    const previousUser = [
      ...current.messages.slice(0, index),
    ]
      .reverse()
      .find(
        (message) =>
          message.role === "user"
      );

    if (!previousUser?.content) return;

    setInput(previousUser.content);

    setTimeout(() => {
      send(previousUser.content);
    }, 0);
  }

  async function handleFiles(event) {
    const selected = Array.from(
      event.target.files || []
    );

    if (!selected.length) return;

    if (
      attachments.length +
        selected.length >
      MAX_ATTACHMENTS
    ) {
      setNotice(
        `You can attach up to ${MAX_ATTACHMENTS} files.`
      );

      event.target.value = "";
      return;
    }

    try {
      const converted = [];

      for (const file of selected) {
        converted.push(
          await fileToAttachment(file)
        );
      }

      setAttachments((items) => [
        ...items,
        ...converted,
      ]);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not attach the file."
      );
    } finally {
      event.target.value = "";
    }
  }

  async function send(forcedText = "") {
    const text =
      String(forcedText || input).trim();

    if (!text && !attachments.length) {
      return;
    }

    if (busy) return;

    let chat = chatsRef.current.find(
      (item) =>
        item.id === activeRef.current
    );

    if (!chat) {
      const newConversation = {
        id: uid(),
        title: titleOf(text),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setChats((items) => [
        ...items,
        newConversation,
      ]);

      setActive(
        newConversation.id
      );

      activeRef.current =
        newConversation.id;

      chat = newConversation;
    }

    const userMessage = {
      id: uid(),
      role: "user",
      content:
        text ||
        "Please analyze the attached files.",
      attachments:
        attachments.map(
          ({ name, mimeType }) => ({
            name,
            mimeType,
          })
        ),
      createdAt: Date.now(),
    };

    const assistantMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      streaming: true,
      createdAt: Date.now(),
    };

    const nextMessages = [
      ...(chat.messages || []),
      userMessage,
      assistantMessage,
    ];

    updateChat(chat.id, (item) => ({
      ...item,
      title:
        item.messages?.length
          ? item.title
          : titleOf(
              text ||
                "Attached files"
            ),
      messages: nextMessages,
      updatedAt: Date.now(),
    }));

    setInput("");
    setAttachments([]);
    setBusy(true);
    setNotice("");

    const controller =
      new AbortController();

    abortRef.current = controller;

    try {
      const history = memory
        ? [
            ...(chat.messages || []),
            userMessage,
          ]
            .filter(
              (message) =>
                message.role ===
                  "user" ||
                message.role ===
                  "assistant"
            )
            .slice(-20)
            .map((message) => ({
              role: message.role,
              content:
                message.content || "",
            }))
        : [userMessage].map(
            (message) => ({
              role: message.role,
              content:
                message.content || "",
            })
          );

      const response = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message:
              text ||
              "Please analyze the attached files.",
            messages: history,
            mode,
            memory,
            customInstructions:
              custom.slice(0, 3000),
            attachments,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Something went wrong.";

        try {
          const data =
            await response.json();

          if (
            typeof data?.error ===
            "string"
          ) {
            errorMessage =
              data.error;
          }
        } catch {}

        throw new Error(
          errorMessage
        );
      }

      if (!response.body) {
        throw new Error(
          "The server returned an empty response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let finalContent = "";

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

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          const trimmed =
            line.trim();

          if (!trimmed) continue;

          let payload =
            trimmed;

          if (
            payload.startsWith(
              "data:"
            )
          ) {
            payload =
              payload
                .slice(5)
                .trim();
          }

          if (
            payload ===
            "[DONE]"
          ) {
            continue;
          }

          try {
            const parsed =
              JSON.parse(payload);

            const delta =
              parsed?.delta ??
              parsed?.text ??
              parsed?.content ??
              parsed?.message?.content ??
              "";

            if (
              typeof delta ===
              "string"
            ) {
              finalContent +=
                delta;

              updateChat(
                chat.id,
                (item) => ({
                  ...item,
                  messages:
                    item.messages.map(
                      (
                        message
                      ) =>
                        message.id ===
                        assistantMessage.id
                          ? {
                              ...message,
                              content:
                                finalContent,
                              streaming:
                                true,
                            }
                          : message
                    ),
                })
              );
            }
          } catch {
            if (
              !trimmed.startsWith(
                "data:"
              )
            ) {
              finalContent +=
                trimmed;

              updateChat(
                chat.id,
                (item) => ({
                  ...item,
                  messages:
                    item.messages.map(
                      (
                        message
                      ) =>
                        message.id ===
                        assistantMessage.id
                          ? {
                              ...message,
                              content:
                                finalContent,
                              streaming:
                                true,
                            }
                          : message
                    ),
                })
              );
            }
          }
        }
      }

      buffer += decoder.decode();

      if (
        buffer.trim() &&
        !finalContent
      ) {
        try {
          const parsed =
            JSON.parse(
              buffer.trim()
            );

          finalContent =
            parsed?.content ||
            parsed?.text ||
            parsed?.message?.content ||
            "";
        } catch {}
      }

      if (!finalContent.trim()) {
        finalContent =
          "I couldn't generate a response. Please try again.";
      }

      updateChat(
        chat.id,
        (item) => ({
          ...item,
          messages:
            item.messages.map(
              (message) =>
                message.id ===
                assistantMessage.id
                  ? {
                      ...message,
                      content:
                        finalContent,
                      streaming:
                        false,
                    }
                  : message
            ),
          updatedAt: Date.now(),
        })
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to reach OZLIND.";

      updateChat(
        chat.id,
        (item) => ({
          ...item,
          messages:
            item.messages.map(
              (entry) =>
                entry.id ===
                assistantMessage.id
                  ? {
                      ...entry,
                      content:
                        message,
                      streaming:
                        false,
                      error: true,
                    }
                  : entry
            ),
          updatedAt: Date.now(),
        })
      );
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div
      className={`ozlind-shell ${
        mobile ? "mobile-open" : ""
      }`}
    >
      <aside
        className="sidebar"
        aria-label="OZLIND navigation"
      >
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>

          <div className="brand-copy">
            <strong>OZLIND</strong>
            <small>INTELLIGENCE</small>
          </div>

          <button
            className="mobile-close"
            onClick={() =>
              setMobile(false)
            }
            aria-label="Close navigation"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <button
          className="new-chat"
          onClick={newChat}
        >
          <Icon name="plus" size={17} />
          <span>New conversation</span>
          <kbd>N</kbd>
        </button>

        <nav className="primary-nav">
          {NAV.map(
            ([id, label, status]) => (
              <button
                key={id}
                className={`nav-item ${
                  (id === "chat" &&
                    mode !==
                      "research" &&
                    mode !== "image") ||
                  (id === "research" &&
                    mode ===
                      "research") ||
                  (id === "image" &&
                    mode === "image")
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  if (
                    id === "research"
                  ) {
                    setMode(
                      "research"
                    );
                  } else if (
                    id === "image"
                  ) {
                    setMode("image");
                  } else if (
                    id === "chat"
                  ) {
                    setMode("auto");
                  }

                  setMobile(false);
                }}
              >
                <span className="nav-icon">
                  <Icon
                    name={
                      id === "image"
                        ? "sparkle"
                        : id
                    }
                    size={17}
                  />
                </span>

                <span>{label}</span>

                <small
                  className={`nav-status ${
                    status === "LIVE"
                      ? "live"
                      : ""
                  }`}
                >
                  {status}
                </small>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-section">
          <div className="section-label">
            <span>History</span>
            {visible.length >
              0 && (
              <button
                onClick={() =>
                  setShowAllHistory(
                    (value) =>
                      !value
                  )
                }
              >
                {showAllHistory
                  ? "Less"
                  : "View all"}
              </button>
            )}
          </div>

          <div className="history-search">
            <Icon
              name="search"
              size={15}
            />

            <input
              data-search
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search conversations"
              aria-label="Search conversations"
            />

            <kbd>⌘K</kbd>
          </div>

          <div className="history-list">
            {visible
              .slice(
                0,
                showAllHistory
                  ? MAX_HISTORY
                  : 6
              )
              .map((chat) => (
                <button
                  key={chat.id}
                  className={`history-item ${
                    active ===
                    chat.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setActive(
                      chat.id
                    );
                    setMobile(false);
                  }}
                >
                  <span className="history-dot" />
                  <span>
                    {chat.title}
                  </span>
                </button>
              ))}

            {!visible.length && (
              <div className="empty-history">
                No conversations found.
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            className="nav-item settings-link"
            onClick={() =>
              setSettingsOpen(true)
            }
          >
            <span className="nav-icon">
              <Icon
                name="settings"
                size={17}
              />
            </span>
            <span>Settings</span>
          </button>

          <div className="profile-card">
            <div className="profile-avatar">
              A
            </div>

            <div>
              <strong>Athul</strong>
              <small>OZLIND User</small>
            </div>

            <span className="profile-dot" />
          </div>
        </div>
      </aside>

      {mobile && (
        <button
          className="mobile-overlay"
          onClick={() =>
            setMobile(false)
          }
          aria-label="Close navigation"
        />
      )}

      <main className="workspace">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() =>
              setMobile(true)
            }
            aria-label="Open navigation"
          >
            <Icon
              name="menu"
              size={19}
            />
          </button>

          <div className="topbar-title">
            <div className="top-mark">
              <span />
            </div>

            <div>
              <strong>OZLIND AI</strong>
              <span>
                <i />
                Online
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            {current && (
              <button
                className="top-action"
                onClick={clearChat}
              >
                <Icon
                  name="trash"
                  size={15}
                />
                <span>Clear</span>
              </button>
            )}

            <button
              className="top-action settings-mobile"
              onClick={() =>
                setSettingsOpen(true)
              }
              aria-label="Settings"
            >
              <Icon
                name="settings"
                size={16}
              />
            </button>
          </div>
        </header>

        <section className="workspace-content">
          {!current ||
          !current.messages?.length ? (
            <div className="welcome">
              <div className="orb">
                <div className="orb-core">
                  <span />
                </div>
              </div>

              <div className="welcome-copy">
                <div className="eyebrow">
                  <span>OZLIND</span>{" "}
                  INTELLIGENCE WORKSPACE
                </div>

                <h1>
                  Think clearly.
                  <br />
                  <em>
                    Create boldly.
                  </em>
                </h1>

                <p>
                  One focused workspace
                  for conversation,
                  research, visual creation
                  and the work between.
                </p>
              </div>

              <div className="quick-grid">
                <button
                  onClick={() =>
                    send(
                      "Explain this concept simply"
                    )
                  }
                >
                  <span className="quick-icon">
                    <Icon
                      name="chat"
                      size={17}
                    />
                  </span>

                  <span>
                    <strong>
                      Explore an idea
                    </strong>

                    <small>
                      Explain something
                      clearly
                    </small>
                  </span>

                  <Icon
                    name="arrow"
                    size={16}
                  />
                </button>

                <button
                  onClick={() =>
                    send(
                      "Help me plan a project"
                    )
                  }
                >
                  <span className="quick-icon">
                    <Icon
                      name="code"
                      size={17}
                    />
                  </span>

                  <span>
                    <strong>
                      Build a plan
                    </strong>

                    <small>
                      Turn an idea into
                      steps
                    </small>
                  </span>

                  <Icon
                    name="arrow"
                    size={16}
                  />
                </button>

                <button
                  onClick={() => {
                    setMode("research");
                    setInput(
                      "Research the latest information about "
                    );

                    setTimeout(
                      () =>
                        textareaRef.current?.focus(),
                      0
                    );
                  }}
                >
                  <span className="quick-icon">
                    <Icon
                      name="research"
                      size={17}
                    />
                  </span>

                  <span>
                    <strong>
                      Research the web
                    </strong>

                    <small>
                      Find current
                      information
                    </small>
                  </span>

                  <Icon
                    name="arrow"
                    size={16}
                  />
                </button>

                <button
                  onClick={() => {
                    setMode("image");
                    setInput(
                      "Create a cinematic image of "
                    );

                    setTimeout(
                      () =>
                        textareaRef.current?.focus(),
                      0
                    );
                  }}
                >
                  <span className="quick-icon">
                    <Icon
                      name="sparkle"
                      size={17}
                    />
                  </span>

                  <span>
                    <strong>
                      Create a visual
                    </strong>

                    <small>
                      Generate an image
                    </small>
                  </span>

                  <Icon
                    name="arrow"
                    size={16}
                  />
                </button>
              </div>
            </div>
          ) : (
            <div className="conversation">
              <div className="conversation-head">
                <div className="conversation-heading">
                  <span className="eyebrow">
                    CONVERSATION
                  </span>

                  <h1>
                    {current.title}
                  </h1>
                </div>

                <button
                  className="clear-button"
                  onClick={
                    clearChat
                  }
                >
                  <Icon
                    name="trash"
                    size={14}
                  />
                  Clear
                </button>
              </div>

              <div
                className="messages"
                aria-live="polite"
              >
                {current.messages.map(
                  (
                    message,
                    index
                  ) => (
                    <article
                      className={`message ${
                        message.role
                      } ${
                        message.error
                          ? "error"
                          : ""
                      }`}
                      key={
                        message.id
                      }
                    >
                      <div className="message-avatar">
                        {message.role ===
                        "user" ? (
                          "Y"
                        ) : (
                          <span className="mini-mark">
                            <span />
                          </span>
                        )}
                      </div>

                      <div className="message-content">
                        <div className="message-meta">
                          <strong>
                            {message.role ===
                            "user"
                              ? "You"
                              : "OZLIND"}
                          </strong>

                          {message.streaming && (
                            <span className="generating">
                              Generating
                            </span>
                          )}
                        </div>

                        <div className="message-body">
                          {message.content ? (
                            <Markdown
                              content={
                                message.content
                              }
                            />
                          ) : (
                            <span className="thinking">
                              <i />
                              <i />
                              <i />
                            </span>
                          )}

                          {message.image && (
                            <img
                              className="generated-image"
                              src={
                                message.image
                              }
                              alt="Generated by OZLIND"
                            />
                          )}

                          {message.streaming &&
                            message.content && (
                              <span
                                className="cursor"
                                aria-label="Generating"
                              />
                            )}
                        </div>

                        {message.sources
                          ?.length >
                          0 && (
                          <details className="sources">
                            <summary>
                              <span className="source-stack">
                                {message.sources
                                  .slice(
                                    0,
                                    4
                                  )
                                  .map(
                                    (
                                      source,
                                      i
                                    ) => (
                                      <img
                                        key={
                                          i
                                        }
                                        src={faviconFor(
                                          source.domain ||
                                            source.url
                                        )}
                                        alt=""
                                      />
                                    )
                                  )}
                              </span>

                              <span>
                                Sources
                              </span>

                              <b>
                                {
                                  message
                                    .sources
                                    .length
                                }
                              </b>

                              <Icon
                                name="chevron"
                                size={13}
                              />
                            </summary>

                            <div className="source-list">
                              {message.sources.map(
                                (
                                  source,
                                  sourceIndex
                                ) => (
                                  <a
                                    key={`${source.url}-${sourceIndex}`}
                                    href={
                                      source.url
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={faviconFor(
                                        source.domain ||
                                          source.url
                                      )}
                                      alt=""
                                    />

                                    <span>
                                      <strong>
                                        {source.title ||
                                          source.domain}
                                      </strong>

                                      <small>
                                        {
                                          source.domain
                                        }
                                      </small>
                                    </span>

                                    <Icon
                                      name="arrow"
                                      size={13}
                                    />
                                  </a>
                                )
                              )}
                            </div>
                          </details>
                        )}

                        {!message.streaming && (
                          <div className="message-actions">
                            {message.content && (
                              <button
                                onClick={() =>
                                  copyMessage(
                                    message.id,
                                    message.content
                                  )
                                }
                              >
                                <Icon
                                  name="copy"
                                  size={13}
                                />

                                {copied ===
                                message.id
                                  ? "Copied"
                                  : "Copy"}
                              </button>
                            )}

                            {message.role ===
                              "user" && (
                              <button
                                onClick={() =>
                                  editMessage(
                                    message
                                  )
                                }
                              >
                                Edit
                              </button>
                            )}

                            {message.role ===
                              "assistant" && (
                              <button
                                onClick={() =>
                                  regenerate(
                                    index
                                  )
                                }
                              >
                                <Icon
                                  name="refresh"
                                  size={13}
                                />
                                Regenerate
                              </button>
                            )}

                            <button
                              onClick={() =>
                                removeMessage(
                                  message.id
                                )
                              }
                            >
                              <Icon
                                name="trash"
                                size={13}
                              />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                )}

                <div ref={endRef} />
              </div>
            </div>
          )}

          {notice && (
            <div
              className="notice"
              role="status"
            >
              <span>{notice}</span>

              <button
                onClick={() =>
                  setNotice("")
                }
                aria-label="Dismiss"
              >
                <Icon
                  name="x"
                  size={14}
                />
              </button>
            </div>
          )}

          <div className="composer-wrap">
            {attachments.length >
              0 && (
              <div
                className="attachment-row"
                aria-label="Selected attachments"
              >
                {attachments.map(
                  (file) => (
                    <button
                      key={`${file.name}-${file.mimeType}`}
                      onClick={() =>
                        setAttachments(
                          (items) =>
                            items.filter(
                              (item) =>
                                item.name !==
                                file.name
                            )
                        )
                      }
                    >
                      <span className="attachment-icon">
                        <Icon
                          name={
                            file.mimeType.startsWith(
                              "image/"
                            )
                              ? "sparkle"
                              : "docs"
                          }
                          size={13}
                        />
                      </span>

                      <span>
                        {file.name}
                      </span>

                      <Icon
                        name="x"
                        size={12}
                      />
                    </button>
                  )
                )}
              </div>
            )}

            <div className="composer-card">
              <div
                className="mode-strip"
                role="tablist"
                aria-label="AI mode"
              >
                <div className="mode-current">
                  <span className="mode-spark">
                    <Icon
                      name="sparkle"
                      size={12}
                    />
                  </span>

                  <span>
                    {activeMode[1]}
                  </span>

                  <small>
                    {activeMode[2]}
                  </small>
                </div>

                <div className="mode-options">
                  {MODES.map(
                    ([id, label]) => (
                      <button
                        key={id}
                        className={
                          mode === id
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setMode(id)
                        }
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  mode === "image"
                    ? "Describe the image you want to create…"
                    : mode ===
                      "research"
                    ? "What should OZLIND research?"
                    : "Ask OZLIND anything…"
                }
                rows={1}
                aria-label="Message OZLIND"
              />

              <div className="composer-footer">
                <div className="composer-left">
                  <button
                    className="tool-button"
                    onClick={() =>
                      fileRef.current?.click()
                    }
                    aria-label="Attach image or file"
                  >
                    <Icon
                      name="paperclip"
                      size={17}
                    />
                  </button>

                  <input
                    ref={fileRef}
                    hidden
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv"
                    onChange={
                      handleFiles
                    }
                  />

                  <button
                    className={`memory-pill ${
                      memory ? "on" : ""
                    }`}
                    onClick={() =>
                      setMemory(
                        (value) =>
                          !value
                      )
                    }
                    title="Controls whether previous messages are included in new requests"
                  >
                    <span className="toggle-dot" />

                    Memory{" "}
                    {memory
                      ? "On"
                      : "Off"}
                  </button>

                  <span className="composer-hint">
                    Shift + Enter for
                    new line
                  </span>
                </div>

                {busy ? (
                  <button
                    className="send-button stop"
                    onClick={stop}
                    aria-label="Stop generation"
                  >
                    <Icon
                      name="stop"
                      size={15}
                    />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    onClick={() =>
                      send()
                    }
                    disabled={
                      !input.trim() &&
                      !attachments.length
                    }
                    aria-label="Send message"
                  >
                    <Icon
                      name="arrow"
                      size={18}
                    />
                  </button>
                )}
              </div>
            </div>

            <p className="disclaimer">
              OZLIND may make mistakes.
              Verify important
              information.
            </p>
          </div>
        </section>
      </main>

      {settingsOpen && (
        <div
          className="modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">
                  PERSONAL WORKSPACE
                </span>

                <h2>Settings</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSettingsOpen(false)
                }
                aria-label="Close settings"
              >
                <Icon
                  name="x"
                  size={18}
                />
              </button>
            </div>

            <div className="setting-block">
              <div className="setting-copy">
                <strong>
                  Conversation memory
                </strong>

                <span>
                  Include previous
                  messages when
                  sending a new
                  request.
                </span>
              </div>

              <button
                className={`switch ${
                  memory ? "on" : ""
                }`}
                onClick={() =>
                  setMemory(
                    (value) =>
                      !value
                  )
                }
                aria-pressed={memory}
              >
                <span />
              </button>
            </div>

            <label className="instruction-label">
              Custom instructions

              <textarea
                value={custom}
                onChange={(event) =>
                  setCustom(
                    event.target.value.slice(
                      0,
                      3000
                    )
                  )
                }
                placeholder="Tell OZLIND how you prefer to work…"
              />
            </label>

            <div className="character-count">
              {custom.length}/3000
            </div>

            <div className="settings-note">
              Preferences are stored
              locally on this device.
              No provider or
              infrastructure details
              are shown in the
              workspace.
            </div>

            <button
              className="primary-button"
              onClick={() =>
                setSettingsOpen(false)
              }
            >
              Save & close
            </button>
          </div>
        </div>
      )}
    </div>
  );
    }
