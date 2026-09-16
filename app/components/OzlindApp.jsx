"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_HISTORY = "ozlind_history_v3";
const STORAGE_SETTINGS = "ozlind_settings_v3";

const DEFAULT_SETTINGS = {
  mode: "auto",
  research: false,
  memory: true,
  style: "balanced",
  length: "medium",
  customInstructions: "",
};

const MODES = [
  {
    id: "auto",
    label: "AUTO",
    description: "OZLIND chooses the right capability",
  },
  {
    id: "fast",
    label: "FAST",
    description: "Fast everyday responses",
  },
  {
    id: "pro",
    label: "PRO",
    description: "More deliberate reasoning",
  },
  {
    id: "vision",
    label: "VISION",
    description: "Images and files",
  },
  {
    id: "research",
    label: "RESEARCH",
    description: "Current information with sources",
  },
];

const MAX_ATTACHMENTS = 4;
const MAX_FILE_SIZE = 12 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
];

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createConversation() {
  return {
    id: makeId("chat"),
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function titleFromMessage(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "New conversation";

  if (clean.length <= 46) return clean;

  return `${clean.slice(0, 46).trim()}…`;
}

function isImageGenerationRequest(text) {
  const value = String(text || "")
    .toLowerCase()
    .trim();

  const patterns = [
    "create an image",
    "create image",
    "generate an image",
    "generate image",
    "make an image",
    "make image",
    "draw an image",
    "draw image",
    "create a picture",
    "create picture",
    "generate a picture",
    "generate picture",
    "make a picture",
    "make picture",
    "design an image",
    "design image",
    "generate artwork",
    "create artwork",
    "make artwork",
    "illustrate",
  ];

  return patterns.some((pattern) =>
    value.includes(pattern)
  );
}

function extractImagePrompt(text) {
  return String(text || "")
    .replace(
      /^(please\s+)?(can you\s+)?(create|generate|make|draw|design)\s+(an?\s+)?(image|picture|artwork)\s*(of)?/i,
      ""
    )
    .trim();
}

function isImageAttachment(attachment) {
  return String(attachment?.mimeType || "").startsWith(
    "image/"
  );
}

function isFileAttachment(attachment) {
  return !isImageAttachment(attachment);
}

function getFileIcon(attachment) {
  const type = String(
    attachment?.mimeType || ""
  ).toLowerCase();

  if (type.startsWith("image/")) return "image";

  return "file";
}

function getDomain(url) {
  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function getSourceLabel(source) {
  return (
    source?.title ||
    getDomain(source?.url) ||
    "Web source"
  );
}

function parseInline(text, keyPrefix) {
  const nodes = [];
  let remaining = String(text || "");
  let key = 0;

  const pattern =
    /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/;

  while (remaining.length) {
    const match = pattern.exec(remaining);

    if (!match) {
      nodes.push(remaining);
      break;
    }

    if (match.index > 0) {
      nodes.push(
        remaining.slice(0, match.index)
      );
    }

    if (match[1]) {
      nodes.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="inline-code"
        >
          {match[2]}
        </code>
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={`${keyPrefix}-${key++}`}>
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      nodes.push(
        <em key={`${keyPrefix}-${key++}`}>
          {match[6]}
        </em>
      );
    } else if (match[7]) {
      nodes.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={match[9]}
          target="_blank"
          rel="noreferrer"
        >
          {match[8]}
        </a>
      );
    }

    remaining = remaining.slice(
      match.index + match[0].length
    );
  }

  return nodes;
}

function renderMarkdown(text) {
  const source = String(text || "");
  const parts = [];
  const codeFence =
    /```([\w+-]*)\n?([\s\S]*?)(```|$)/g;

  let lastIndex = 0;
  let match;

  while ((match = codeFence.exec(source))) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: source.slice(
          lastIndex,
          match.index
        ),
      });
    }

    parts.push({
      type: "code",
      lang: match[1],
      content: match[2],
    });

    lastIndex = codeFence.lastIndex;
  }

  if (lastIndex < source.length) {
    parts.push({
      type: "text",
      content: source.slice(lastIndex),
    });
  }

  const nodes = [];
  let blockKey = 0;

  parts.forEach((part) => {
    if (part.type === "code") {
      nodes.push(
        <pre
          key={`code-${blockKey}`}
          className="code-block"
        >
          {part.lang && (
            <div className="code-lang">
              {part.lang}
            </div>
          )}
          <code>{part.content}</code>
        </pre>
      );

      blockKey += 1;
      return;
    }

    const blocks = part.content.split(
      /\n{2,}/
    );

    blocks.forEach((block) => {
      const trimmed = block.trim();

      if (!trimmed) return;

      const lines = trimmed.split("\n");

      /*
       * Tables
       */
      if (
        lines.length >= 2 &&
        lines[0].includes("|") &&
        /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(
          lines[1]
        )
      ) {
        const cleanRow = (line) =>
          line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());

        const headers = cleanRow(lines[0]);
        const rows = lines
          .slice(2)
          .map(cleanRow);

        nodes.push(
          <div
            key={`table-${blockKey}`}
            className="md-table-wrap"
          >
            <table className="md-table">
              <thead>
                <tr>
                  {headers.map(
                    (header, index) => (
                      <th key={index}>
                        {parseInline(
                          header,
                          `table-h-${blockKey}-${index}`
                        )}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map(
                        (_, columnIndex) => (
                          <td
                            key={columnIndex}
                          >
                            {parseInline(
                              row[
                                columnIndex
                              ] || "",
                              `table-${blockKey}-${rowIndex}-${columnIndex}`
                            )}
                          </td>
                        )
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );

        blockKey += 1;
        return;
      }

      /*
       * Unordered list
       */
      if (
        lines.every((line) =>
          /^\s*[-*]\s+/.test(line)
        )
      ) {
        nodes.push(
          <ul
            key={`list-${blockKey}`}
            className="md-list"
          >
            {lines.map((line, index) => (
              <li key={index}>
                {parseInline(
                  line.replace(
                    /^\s*[-*]\s+/,
                    ""
                  ),
                  `list-${blockKey}-${index}`
                )}
              </li>
            ))}
          </ul>
        );

        blockKey += 1;
        return;
      }

      /*
       * Ordered list
       */
      if (
        lines.every((line) =>
          /^\s*\d+\.\s+/.test(line)
        )
      ) {
        nodes.push(
          <ol
            key={`olist-${blockKey}`}
            className="md-list"
          >
            {lines.map((line, index) => (
              <li key={index}>
                {parseInline(
                  line.replace(
                    /^\s*\d+\.\s+/,
                    ""
                  ),
                  `olist-${blockKey}-${index}`
                )}
              </li>
            ))}
          </ol>
        );

        blockKey += 1;
        return;
      }

      /*
       * Blockquote
       */
      if (
        lines.every((line) =>
          /^\s*>/.test(line)
        )
      ) {
        nodes.push(
          <blockquote
            key={`quote-${blockKey}`}
            className="md-quote"
          >
            {lines.map(
              (line, index) => (
                <span key={index}>
                  {parseInline(
                    line.replace(
                      /^\s*>\s?/,
                      ""
                    ),
                    `quote-${blockKey}-${index}`
                  )}
                  {index <
                    lines.length - 1 && (
                    <br />
                  )}
                </span>
              )
            )}
          </blockquote>
        );

        blockKey += 1;
        return;
      }

      /*
       * Heading
       */
      const headingMatch =
        trimmed.match(
          /^(#{1,4})\s+(.*)$/
        );

      if (headingMatch) {
        nodes.push(
          <div
            key={`heading-${blockKey}`}
            className={`md-heading md-h${headingMatch[1].length}`}
          >
            {parseInline(
              headingMatch[2],
              `heading-${blockKey}`
            )}
          </div>
        );

        blockKey += 1;
        return;
      }

      /*
       * Horizontal rule
       */
      if (
        /^(-{3,}|\*{3,})$/.test(trimmed)
      ) {
        nodes.push(
          <hr
            key={`hr-${blockKey}`}
            className="md-rule"
          />
        );

        blockKey += 1;
        return;
      }

      /*
       * Paragraph
       */
      nodes.push(
        <p
          key={`paragraph-${blockKey}`}
          className="md-paragraph"
        >
          {lines.map((line, index) => (
            <span key={index}>
              {parseInline(
                line,
                `paragraph-${blockKey}-${index}`
              )}
              {index <
                lines.length - 1 && (
                <br />
              )}
            </span>
          ))}
        </p>
      );

      blockKey += 1;
    });
  });

  return nodes;
}

function Icon({
  name,
  size = 18,
}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <use
        href={`/ozlind-icons.svg#i-${name}`}
      />
    </svg>
  );
}

function Logo({
  size = 22,
  className = "",
}) {
  return (
    <svg
      className={`ozl-logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <use href="/ozlind-icons.svg#ozl-mark" />
    </svg>
  );
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result =
          String(reader.result || "");

        const commaIndex =
          result.indexOf(",");

        resolve(
          commaIndex >= 0
            ? result.slice(
                commaIndex + 1
              )
            : result
        );
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Could not read the file."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

export default function OzlindApp() {
  const [booting, setBooting] =
    useState(true);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [view, setView] =
    useState("chat");

  const [conversation, setConversation] =
    useState(() =>
      createConversation()
    );

  const [history, setHistory] =
    useState([]);

  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [editingId, setEditingId] =
    useState(null);

  const [attachments, setAttachments] =
    useState([]);

  const [expandedSources, setExpandedSources] =
    useState({});

  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  /*
   * Boot
   */
  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setBooting(false);
      }, 650);

    return () =>
      window.clearTimeout(timer);
  }, []);

  /*
   * Load local state
   */
  useEffect(() => {
    try {
      const storedHistory =
        safeParse(
          window.localStorage.getItem(
            STORAGE_HISTORY
          ),
          []
        );

      const storedSettings =
        safeParse(
          window.localStorage.getItem(
            STORAGE_SETTINGS
          ),
          DEFAULT_SETTINGS
        );

      if (Array.isArray(storedHistory)) {
        setHistory(
          storedHistory.filter(
            (item) =>
              item &&
              typeof item.id ===
                "string"
          )
        );
      }

      if (
        storedSettings &&
        typeof storedSettings ===
          "object"
      ) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...storedSettings,
        });
      }
    } catch {
      // Local storage may be unavailable.
    }
  }, []);

  /*
   * Save settings
   */
  useEffect(() => {
    if (booting) return;

    try {
      window.localStorage.setItem(
        STORAGE_SETTINGS,
        JSON.stringify(settings)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [settings, booting]);

  /*
   * Auto-scroll
   */
  useEffect(() => {
    if (booting) return;

    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "end",
      }
    );
  }, [
    conversation.messages,
    booting,
  ]);

  /*
   * Keyboard shortcuts
   */
  useEffect(() => {
    function handleShortcut(event) {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() ===
          "n"
      ) {
        event.preventDefault();
        startNewChat();
      }
    }

    window.addEventListener(
      "keydown",
      handleShortcut
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleShortcut
      );
  });

  /*
   * Search
   */
  const filteredHistory = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return history;

    return history.filter((item) => {
      const title =
        String(
          item.title || ""
        ).toLowerCase();

      const messageText =
        Array.isArray(
          item.messages
        )
          ? item.messages
              .map((message) =>
                String(
                  message?.content ||
                    ""
                )
              )
              .join(" ")
              .toLowerCase()
          : "";

      return (
        title.includes(query) ||
        messageText.includes(query)
      );
    });
  }, [history, search]);

  function showNotice(message) {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2400);
  }

  /*
   * History persistence
   */
  const persistConversation =
    useCallback(
      (nextConversation) => {
        setHistory((current) => {
          const exists =
            current.some(
              (item) =>
                item.id ===
                nextConversation.id
            );

          const updated = exists
            ? current.map((item) =>
                item.id ===
                nextConversation.id
                  ? nextConversation
                  : item
              )
            : [
                nextConversation,
                ...current,
              ];

          const normalized =
            updated
              .filter(Boolean)
              .sort(
                (a, b) =>
                  Number(
                    b.updatedAt || 0
                  ) -
                  Number(
                    a.updatedAt || 0
                  )
              )
              .slice(0, 50);

          try {
            window.localStorage.setItem(
              STORAGE_HISTORY,
              JSON.stringify(
                normalized
              )
            );
          } catch {
            // Ignore storage errors.
          }

          return normalized;
        });
      },
      []
    );

  /*
   * Conversation updater
   */
  const updateConversation =
    useCallback(
      (
        updater,
        persist = true
      ) => {
        setConversation(
          (current) => {
            const next =
              typeof updater ===
              "function"
                ? updater(current)
                : updater;

            if (!next) return current;

            const normalized = {
              ...next,
              updatedAt:
                Date.now(),
            };

            if (persist) {
              persistConversation(
                normalized
              );
            }

            return normalized;
          }
        );
      },
      [persistConversation]
    );

  function startNewChat() {
    abortRef.current?.abort();

    setSending(false);
    setEditingId(null);
    setInput("");
    setAttachments([]);
    setExpandedSources({});
    setConversation(
      createConversation()
    );
    setView("chat");
    setSidebarOpen(false);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
  }

  function openConversation(item) {
    if (!item) return;

    setConversation({
      ...item,
      messages: Array.isArray(
        item.messages
      )
        ? item.messages
        : [],
    });

    setView("chat");
    setSidebarOpen(false);
    setEditingId(null);
    setAttachments([]);
  }

  function clearCurrentChat() {
    abortRef.current?.abort();

    const next = {
      ...conversation,
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    };

    setConversation(next);
    persistConversation(next);

    setEditingId(null);
    setAttachments([]);
  }

  /*
   * File upload
   */
  async function handleFileSelection(
    event
  ) {
    const files = Array.from(
      event.target.files || []
    );

    event.target.value = "";

    if (!files.length) return;

    if (
      attachments.length >=
      MAX_ATTACHMENTS
    ) {
      showNotice(
        `Maximum ${MAX_ATTACHMENTS} files`
      );
      return;
    }

    const available =
      MAX_ATTACHMENTS -
      attachments.length;

    const selected =
      files.slice(0, available);

    const next = [];

    for (const file of selected) {
      if (
        !ALLOWED_TYPES.includes(
          file.type
        )
      ) {
        showNotice(
          `${file.name}: unsupported file type`
        );
        continue;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        showNotice(
          `${file.name}: file is too large`
        );
        continue;
      }

      try {
        const data =
          await fileToBase64(file);

        next.push({
          id: makeId("file"),
          name: file.name,
          mimeType:
            file.type ||
            "application/octet-stream",
          size: file.size,
          data,
          preview:
            file.type.startsWith(
              "image/"
            )
              ? `data:${file.type};base64,${data}`
              : "",
        });
      } catch {
        showNotice(
          `Could not read ${file.name}`
        );
      }
    }

    if (next.length) {
      setAttachments((current) => [
        ...current,
        ...next,
      ]);

      setSettings((current) => ({
        ...current,
        mode: "vision",
      }));
    }
  }

  function removeAttachment(id) {
    setAttachments((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  /*
   * Image generation
   */
  async function generateImage(
    prompt,
    imageAttachments
  ) {
    const response =
      await fetch(
        "/api/image-generate",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            prompt,
            aspect: "square",
            imageSize: "1K",
            images:
              imageAttachments
                .filter(
                  isImageAttachment
                )
                .map((item) => ({
                  data: item.data,
                  mimeType:
                    item.mimeType,
                  name: item.name,
                })),
          }),
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Image generation could not be completed."
      );
    }

    return data;
  }

  /*
   * Send chat request
   */
  async function requestChat({
    message,
    messages,
    localAttachments = [],
    modeOverride,
  }) {
    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message,
            messages,
            attachments:
              localAttachments.map(
                (item) => ({
                  name: item.name,
                  mimeType:
                    item.mimeType,
                  data: item.data,
                })
              ),
            provider:
              modeOverride ||
              settings.mode,
            mode:
              modeOverride ||
              settings.mode,
            research:
              settings.research ||
              settings.mode ===
                "research",
            memory:
              settings.memory,
            style:
              settings.style,
            length:
              settings.length,
            customInstructions:
              settings.customInstructions,
          }),
        }
      );

    if (!response.ok) {
      const data =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        data.error ||
          `Request failed with status ${response.status}`
      );
    }

    return response;
  }

  /*
   * Core send implementation
   *
   * Explicit message parameter is used so
   * regenerate/edit never depends on async
   * React state timing.
   */
  async function sendMessageWithContent(
    rawMessage,
    {
      editingMessageId = null,
      regeneration = false,
    } = {}
  ) {
    const message =
      String(rawMessage || "")
        .trim();

    if (!message || sending) {
      return;
    }

    setInput("");
    setEditingId(null);

    if (
      textareaRef.current
    ) {
      textareaRef.current.style.height =
        "auto";
    }

    const currentMessages =
      conversation.messages;

    let nextMessages;

    if (editingMessageId) {
      const index =
        currentMessages.findIndex(
          (item) =>
            item.id ===
            editingMessageId
        );

      if (index >= 0) {
        nextMessages = [
          ...currentMessages.slice(
            0,
            index
          ),
          {
            ...currentMessages[index],
            content: message,
            updatedAt: Date.now(),
          },
        ];
      } else {
        nextMessages = [
          ...currentMessages,
        ];
      }
    } else if (
      regeneration
    ) {
      nextMessages = [
        ...currentMessages,
      ];
    } else {
      const userMessage = {
        id: makeId("msg"),
        role: "user",
        content: message,
        createdAt: Date.now(),
      };

      nextMessages = [
        ...currentMessages,
        userMessage,
      ];
    }

    const nextTitle =
      currentMessages.length ===
        0 ||
      (
        editingMessageId &&
        currentMessages.findIndex(
          (item) =>
            item.id ===
            editingMessageId
        ) === 0
      )
        ? titleFromMessage(message)
        : conversation.title ===
            "New conversation"
          ? titleFromMessage(message)
          : conversation.title;

    /*
     * If editing a user message,
     * remove everything after it.
     */
    if (editingMessageId) {
      const index =
        nextMessages.findIndex(
          (item) =>
            item.id ===
            editingMessageId
        );

      if (index >= 0) {
        nextMessages =
          nextMessages.slice(
            0,
            index + 1
          );
      }
    }

    const assistantId =
      makeId("msg");

    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      streaming: true,
    };

    const messagesWithAssistant = [
      ...nextMessages,
      assistantMessage,
    ];

    const nextConversation = {
      ...conversation,
      title: nextTitle,
      messages:
        messagesWithAssistant,
      updatedAt: Date.now(),
    };

    setConversation(
      nextConversation
    );
    persistConversation(
      nextConversation
    );

    setSending(true);

    /*
     * Capability routing
     */
    const imageRequest =
      isImageGenerationRequest(
        message
      );

    const imageAttachments =
      attachments.filter(
        isImageAttachment
      );

    if (
      imageRequest &&
      (
        imageAttachments.length >
          0 ||
        !localStorage.getItem(
          "ozlind_disable_image_generation"
        )
      )
    ) {
      const loadingMessages =
        messagesWithAssistant.map(
          (item) =>
            item.id ===
            assistantId
              ? {
                  ...item,
                  content:
                    imageAttachments.length >
                    0
                      ? "Editing your image…"
                      : "Creating your image…",
                  imageLoading: true,
                }
              : item
        );

      const loadingConversation =
        {
          ...nextConversation,
          messages:
            loadingMessages,
          updatedAt: Date.now(),
        };

      setConversation(
        loadingConversation
      );
      persistConversation(
        loadingConversation
      );

      try {
        const result =
          await generateImage(
            extractImagePrompt(
              message
            ) || message,
            imageAttachments
          );

        const finalMessages =
          loadingMessages.map(
            (item) =>
              item.id ===
              assistantId
                ? {
                    ...item,
                    content:
                      result.message ||
                      (
                        imageAttachments.length >
                        0
                          ? "Image edited."
                          : "Image created."
                      ),
                    imageUrl:
                      result.imageUrl,
                    imageLoading:
                      false,
                    mode:
                      imageAttachments.length >
                      0
                        ? "vision"
                        : "creation",
                  }
                : item
          );

        const finalConversation =
          {
            ...loadingConversation,
            messages:
              finalMessages,
            updatedAt: Date.now(),
          };

        setConversation(
          finalConversation
        );
        persistConversation(
          finalConversation
        );

        setAttachments([]);
      } catch (error) {
        const finalMessages =
          loadingMessages.map(
            (item) =>
              item.id ===
              assistantId
                ? {
                    ...item,
                    content:
                      error?.message ||
                      "Image generation failed. Please try again.",
                    imageLoading:
                      false,
                    error: true,
                  }
                : item
          );

        const finalConversation =
          {
            ...loadingConversation,
            messages:
              finalMessages,
            updatedAt: Date.now(),
          };

        setConversation(
          finalConversation
        );
        persistConversation(
          finalConversation
        );
      } finally {
        setSending(false);
      }

      return;
    }

    /*
     * Normal chat
     */
    const controller =
      new AbortController();

    abortRef.current =
      controller;

    try {
      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",
            signal:
              controller.signal,
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              message,
              messages:
                nextMessages.map(
                  (item) => ({
                    role:
                      item.role,
                    content:
                      item.content,
                  })
                ),
              attachments:
                attachments.map(
                  (item) => ({
                    name: item.name,
                    mimeType:
                      item.mimeType,
                    data: item.data,
                  })
                ),
              provider:
                settings.mode,
              mode:
                settings.mode,
              research:
                settings.research ||
                settings.mode ===
                  "research",
              memory:
                settings.memory,
              style:
                settings.style,
              length:
                settings.length,
              customInstructions:
                settings.customInstructions,
            }),
          }
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            `Request failed with status ${response.status}`
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      /*
       * JSON response
       */
      if (
        !contentType.includes(
          "text/event-stream"
        )
      ) {
        const data =
          await response
            .json();

        const text =
          data?.text ||
          data?.message ||
          "";

        if (!text) {
          throw new Error(
            "The AI returned an empty response."
          );
        }

        const finalMessages =
          messagesWithAssistant.map(
            (item) =>
              item.id ===
              assistantId
                ? {
                    ...item,
                    content: text,
                    streaming:
                      false,
                    mode:
                      settings.mode,
                    sources:
                      data.sources ||
                      [],
                  }
                : item
          );

        const finalConversation =
          {
            ...nextConversation,
            messages:
              finalMessages,
            updatedAt: Date.now(),
          };

        setConversation(
          finalConversation
        );
        persistConversation(
          finalConversation
        );

        setAttachments([]);

        return;
      }

      /*
       * SSE
       */
      if (!response.body) {
        throw new Error(
          "The AI stream was unavailable."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let accumulated = "";
      let sources = [];

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

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

          if (
            !line.startsWith(
              "data:"
            )
          ) {
            continue;
          }

          const raw =
            line
              .slice(5)
              .trim();

          if (
            !raw ||
            raw === "[DONE]"
          ) {
            continue;
          }

          try {
            const event =
              JSON.parse(raw);

            /*
             * Current backend emits:
             * type: "text"
             */
            if (
              event.type ===
              "text"
            ) {
              accumulated +=
                event.text ||
                "";

              setConversation(
                (current) => {
                  const updatedMessages =
                    current.messages.map(
                      (item) =>
                        item.id ===
                        assistantId
                          ? {
                              ...item,
                              content:
                                accumulated,
                              streaming:
                                true,
                            }
                          : item
                    );

                  return {
                    ...current,
                    messages:
                      updatedMessages,
                    updatedAt:
                      Date.now(),
                  };
                }
              );
            }

            /*
             * Backward compatibility
             * with older delta events.
             */
            if (
              event.type ===
              "delta"
            ) {
              accumulated +=
                event.text ||
                "";

              setConversation(
                (current) => {
                  const updatedMessages =
                    current.messages.map(
                      (item) =>
                        item.id ===
                        assistantId
                          ? {
                              ...item,
                              content:
                                accumulated,
                              streaming:
                                true,
                            }
                          : item
                    );

                  return {
                    ...current,
                    messages:
                      updatedMessages,
                    updatedAt:
                      Date.now(),
                  };
                }
              );
            }

            if (
              event.type ===
              "done"
            ) {
              sources =
                Array.isArray(
                  event.sources
                )
                  ? event.sources
                  : [];
            }

            if (
              event.type ===
              "error"
            ) {
              throw new Error(
                event.error ||
                  "The AI response could not be completed."
              );
            }
          } catch (parseError) {
            /*
             * Do not break the stream
             * because of malformed chunks.
             */
            if (
              parseError instanceof
                Error &&
              parseError.message ===
                "The AI response could not be completed."
            ) {
              throw parseError;
            }
          }
        }
      }

      const finalMessages =
        conversation.messages.map(
          (item) =>
            item.id ===
            assistantId
              ? {
                  ...item,
                  content:
                    accumulated ||
                    "The AI returned an empty response.",
                  streaming:
                    false,
                  sources,
                  mode:
                    settings.mode,
                }
              : item
        );

      const finalConversation =
        {
          ...conversation,
          title: nextTitle,
          messages:
            finalMessages,
          updatedAt: Date.now(),
        };

      setConversation(
        finalConversation
      );
      persistConversation(
        finalConversation
      );

      setAttachments([]);
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        setConversation(
          (current) => {
            const finalMessages =
              current.messages.map(
                (item) =>
                  item.id ===
                  assistantId
                    ? {
                        ...item,
                        content:
                          item.content ||
                          "Generation stopped.",
                        streaming:
                          false,
                      }
                    : item
              );

            const next = {
              ...current,
              messages:
                finalMessages,
              updatedAt:
                Date.now(),
            };

            persistConversation(
              next
            );

            return next;
          }
        );

        return;
      }

      const errorText =
        error?.message ||
        "Something went wrong while contacting OZLIND.";

      setConversation(
        (current) => {
          const finalMessages =
            current.messages.map(
              (item) =>
                item.id ===
                assistantId
                  ? {
                      ...item,
                      content:
                        errorText,
                      streaming:
                        false,
                      error: true,
                    }
                  : item
            );

          const next = {
            ...current,
            title: nextTitle,
            messages:
              finalMessages,
            updatedAt:
              Date.now(),
          };

          persistConversation(
            next
          );

          return next;
        }
      );
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  /*
   * Public send
   */
  async function sendMessage() {
    if (sending) return;

    const message =
      input.trim();

    if (!message) return;

    await sendMessageWithContent(
      message
    );
  }

  /*
   * Stop
   */
  function stopGeneration() {
    abortRef.current?.abort();
  }

  /*
   * Copy
   */
  async function copyMessage(
    content
  ) {
    try {
      await navigator.clipboard.writeText(
        String(content || "")
      );

      showNotice("Copied");
    } catch {
      showNotice("Copy failed");
    }
  }

  /*
   * Edit
   */
  function editMessage(message) {
    if (!message) return;

    setInput(
      message.content || ""
    );

    setEditingId(message.id);

    setTimeout(() => {
      textareaRef.current?.focus();

      if (
        textareaRef.current
      ) {
        textareaRef.current.style.height =
          "auto";

        textareaRef.current.style.height =
          `${Math.min(
            textareaRef.current
              .scrollHeight,
            180
          )}px`;
      }
    }, 50);
  }

  /*
   * Delete
   */
  function deleteMessage(
    messageId
  ) {
    const nextMessages =
      conversation.messages.filter(
        (item) =>
          item.id !== messageId
      );

    const next = {
      ...conversation,
      messages:
        nextMessages,
      updatedAt: Date.now(),
    };

    setConversation(next);
    persistConversation(next);
  }

  /*
   * Regenerate
   *
   * Fixed implementation:
   * no async setInput dependency.
   */
  async function regenerateMessage(
    messageId
  ) {
    if (sending) return;

    const index =
      conversation.messages.findIndex(
        (item) =>
          item.id === messageId
      );

    if (index < 0) return;

    const assistant =
      conversation.messages[index];

    if (
      assistant.role !==
      "assistant"
    ) {
      return;
    }

    const previousUser =
      conversation.messages
        .slice(0, index)
        .reverse()
        .find(
          (item) =>
            item.role ===
            "user"
        );

    if (!previousUser) return;

    const messagesBefore =
      conversation.messages.slice(
        0,
        index
      );

    const savedConversation =
      {
        ...conversation,
        messages:
          messagesBefore,
        updatedAt: Date.now(),
      };

    setConversation(
      savedConversation
    );
    persistConversation(
      savedConversation
    );

    /*
     * Rebuild request directly.
     */
    await sendMessageWithContent(
      previousUser.content,
      {
        regeneration: true,
      }
    );
  }

  /*
   * Textarea
   */
  function handleInputChange(
    event
  ) {
    setInput(
      event.target.value
    );

    const target =
      event.target;

    target.style.height =
      "auto";

    target.style.height =
      `${Math.min(
        target.scrollHeight,
        180
      )}px`;
  }

  function handleTextareaKeyDown(
    event
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  /*
   * Source expansion
   */
  function toggleSource(
    key
  ) {
    setExpandedSources(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      })
    );
  }

  /*
   * Render source cards
   */
  function renderSources(
    sources
  ) {
    if (
      !Array.isArray(
        sources
      ) ||
      sources.length === 0
    ) {
      return null;
    }

    return (
      <div className="sources-box">
        <div className="sources-title">
          <Icon
            name="globe"
            size={14}
          />
          <span>
            Sources
          </span>
          <span className="sources-count">
            {sources.length}
          </span>
        </div>

        <div className="source-list">
          {sources
            .slice(0, 6)
            .map(
              (
                source,
                index
              ) => {
                const key = `${source.url}-${index}`;
                const expanded =
                  Boolean(
                    expandedSources[
                      key
                    ]
                  );

                return (
                  <div
                    key={key}
                    className={`source-card ${
                      expanded
                        ? "expanded"
                        : ""
                    }`}
                  >
                    <button
                      className="source-main"
                      onClick={() =>
                        toggleSource(
                          key
                        )
                      }
                    >
                      <span className="source-favicon">
                        {getDomain(
                          source.url
                        )
                          ? getDomain(
                              source.url
                            )
                              .slice(
                                0,
                                1
                              )
                              .toUpperCase()
                          : "W"}
                      </span>

                      <span className="source-copy">
                        <strong>
                          {getSourceLabel(
                            source
                          )}
                        </strong>

                        <small>
                          {getDomain(
                            source.url
                          ) ||
                            "Web source"}
                        </small>
                      </span>

                      <span className="source-number">
                        {index + 1}
                      </span>
                    </button>

                    {expanded && (
                      <div className="source-detail">
                        {source.content && (
                          <p>
                            {
                              source.content
                            }
                          </p>
                        )}

                        {source.url && (
                          <a
                            href={
                              source.url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="source-open"
                          >
                            Open source
                            <span>
                              ↗
                            </span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
        </div>
      </div>
    );
  }

  /*
   * Render message
   */
  function renderMessage(
    message
  ) {
    const isUser =
      message.role ===
      "user";

    const attachmentsForMessage =
      Array.isArray(
        message.attachments
      )
        ? message.attachments
        : [];

    return (
      <article
        key={message.id}
        className={`message-row ${
          isUser
            ? "message-user"
            : "message-ai"
        }`}
      >
        {!isUser && (
          <div className="assistant-avatar">
            <Logo size={18} />
          </div>
        )}

        <div className="message-column">
          <div
            className={`message-bubble ${
              isUser
                ? "user-bubble"
                : "ai-bubble"
            }`}
          >
            {!isUser && (
              <div className="message-author">
                <span>
                  OZLIND
                </span>

                {message.streaming && (
                  <span className="thinking-label">
                    thinking
                  </span>
                )}
              </div>
            )}

            {isUser &&
              attachmentsForMessage.length >
                0 && (
                <div className="message-attachments">
                  {attachmentsForMessage.map(
                    (
                      attachment
                    ) => (
                      <div
                        key={
                          attachment.id ||
                          attachment.name
                        }
                        className="message-attachment"
                      >
                        {attachment.preview ? (
                          <img
                            src={
                              attachment.preview
                            }
                            alt={
                              attachment.name
                            }
                          />
                        ) : (
                          <div className="file-preview-icon">
                            <Icon
                              name={
                                getFileIcon(
                                  attachment
                                )
                              }
                              size={18}
                            />
                          </div>
                        )}

                        <span>
                          {
                            attachment.name
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

            <div className="message-content">
              {message.content ? (
                isUser ? (
                  <div className="user-text">
                    {message.content}
                  </div>
                ) : (
                  renderMarkdown(
                    message.content
                  )
                )
              ) : (
                <span className="typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              )}

              {message.imageLoading && (
                <div className="image-loading">
                  <span className="loader" />
                  <span>
                    {message.content ||
                      "Creating image…"}
                  </span>
                </div>
              )}

              {message.imageUrl && (
                <div className="generated-image">
                  <img
                    src={
                      message.imageUrl
                    }
                    alt="Created by OZLIND"
                  />
                </div>
              )}
            </div>

            {!isUser &&
              renderSources(
                message.sources
              )}
          </div>

          {!message.streaming && (
            <div className="message-actions">
              <button
                onClick={() =>
                  copyMessage(
                    message.content
                  )
                }
                title="Copy"
                aria-label="Copy message"
              >
                <Icon
                  name="copy"
                  size={14}
                />
              </button>

              {isUser && (
                <button
                  onClick={() =>
                    editMessage(
                      message
                    )
                  }
                  title="Edit"
                  aria-label="Edit message"
                >
                  <Icon
                    name="edit"
                    size={14}
                  />
                </button>
              )}

              {!isUser && (
                <button
                  onClick={() =>
                    regenerateMessage(
                      message.id
                    )
                  }
                  title="Regenerate"
                  aria-label="Regenerate"
                >
                  <Icon
                    name="refresh"
                    size={14}
                  />
                </button>
              )}

              <button
                onClick={() =>
                  deleteMessage(
                    message.id
                  )
                }
                title="Delete"
                aria-label="Delete message"
              >
                <Icon
                  name="trash"
                  size={14}
                />
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  /*
   * Attachment composer
   */
  function renderAttachmentStrip() {
    if (
      attachments.length === 0
    ) {
      return null;
    }

    return (
      <div className="attachment-strip">
        {attachments.map(
          (attachment) => (
            <div
              key={attachment.id}
              className="attachment-chip"
            >
              {attachment.preview ? (
                <img
                  src={
                    attachment.preview
                  }
                  alt=""
                />
              ) : (
                <span className="attachment-file-icon">
                  <Icon
                    name={getFileIcon(
                      attachment
                    )}
                    size={16}
                  />
                </span>
              )}

              <span className="attachment-name">
                {attachment.name}
              </span>

              <button
                onClick={() =>
                  removeAttachment(
                    attachment.id
                  )
                }
                aria-label={`Remove ${attachment.name}`}
                title="Remove"
              >
                <Icon
                  name="close"
                  size={13}
                />
              </button>
            </div>
          )
        )}
      </div>
    );
  }

  /*
   * Mode selector
   */
  function renderModeSelector() {
    const activeMode =
      MODES.find(
        (item) =>
          item.id ===
          settings.mode
      ) || MODES[0];

    return (
      <div className="mode-selector">
        <select
          value={
            settings.mode
          }
          onChange={(event) =>
            setSettings(
              (current) => ({
                ...current,
                mode:
                  event.target
                    .value,
              })
            )
          }
          aria-label="OZLIND mode"
        >
          {MODES.map(
            (mode) => (
              <option
                key={mode.id}
                value={mode.id}
              >
                {mode.label}
              </option>
            )
          )}
        </select>

        <span className="mode-description">
          {activeMode.description}
        </span>
      </div>
    );
  }

  /*
   * Chat
   */
  function renderChat() {
    const hasMessages =
      conversation.messages
        .length > 0;

    return (
      <section className="chat-view">
        <div className="chat-header">
          <div className="chat-heading">
            <button
              className="mobile-menu"
              onClick={() =>
                setSidebarOpen(
                  true
                )
              }
              aria-label="Open menu"
            >
              <Icon
                name="menu"
                size={20}
              />
            </button>

            <div>
              <div className="eyebrow">
                ONE CHAT · MANY CAPABILITIES
              </div>

              <h1>
                {hasMessages
                  ? conversation.title
                  : "AI Chat"}
              </h1>
            </div>
          </div>

          <div className="header-actions">
            {hasMessages && (
              <button
                className="ghost-button"
                onClick={
                  clearCurrentChat
                }
              >
                Clear
              </button>
            )}

            <button
              className="new-chat-button"
              onClick={
                startNewChat
              }
            >
              <Icon
                name="plus"
                size={17}
              />
              <span>
                New Chat
              </span>
            </button>
          </div>
        </div>

        {!hasMessages ? (
          <div className="empty-chat">
            <div className="hero-mark">
              <Logo size={36} />
            </div>

            <div className="hero-kicker">
              INTELLIGENCE, REFINED.
            </div>

            <h2>
              What do you want to
              explore?
            </h2>

            <p>
              Ask anything. OZLIND can
              reason, research, understand
              images and files, write code,
              or create images — all from
              this conversation.
            </p>

            <div className="prompt-grid">
              <button
                onClick={() =>
                  setInput(
                    "Explain quantum computing simply"
                  )
                }
              >
                <span className="prompt-icon">
                  ✦
                </span>

                <strong>
                  Explain something
                </strong>

                <span>
                  Make a complex topic
                  simple
                </span>
              </button>

              <button
                onClick={() => {
                  setSettings(
                    (current) => ({
                      ...current,
                      mode:
                        "research",
                    })
                  );

                  setInput(
                    "Research the latest AI developments"
                  );
                }}
              >
                <span className="prompt-icon">
                  ◌
                </span>

                <strong>
                  Research the web
                </strong>

                <span>
                  Find current information
                  with sources
                </span>
              </button>

              <button
                onClick={() =>
                  setInput(
                    "Create an image of a cinematic Kerala landscape at sunset"
                  )
                }
              >
                <span className="prompt-icon">
                  ◇
                </span>

                <strong>
                  Create an image
                </strong>

                <span>
                  Generate directly in
                  chat
                </span>
              </button>

              <button
                onClick={() =>
                  setInput(
                    "Help me plan a productive week"
                  )
                }
              >
                <span className="prompt-icon">
                  +
                </span>

                <strong>
                  Plan something
                </strong>

                <span>
                  Turn ideas into an
                  action plan
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-area">
            <div className="messages-inner">
              {conversation.messages.map(
                renderMessage
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>
          </div>
        )}

        <div className="composer-zone">
          <div className="composer">
            {renderAttachmentStrip()}

            {editingId && (
              <div className="editing-bar">
                <div>
                  <span>
                    Editing message
                  </span>

                  <small>
                    Change it and press
                    send
                  </small>
                </div>

                <button
                  onClick={() => {
                    setEditingId(
                      null
                    );
                    setInput("");
                  }}
                  aria-label="Cancel editing"
                >
                  <Icon
                    name="close"
                    size={14}
                  />
                </button>
              </div>
            )}

            <div className="composer-top">
              {settings.research && (
                <span className="composer-chip active">
                  <Icon
                    name="globe"
                    size={13}
                  />
                  Web Research
                </span>
              )}

              {settings.memory && (
                <span className="composer-chip muted">
                  Context on
                </span>
              )}

              {attachments.length >
                0 && (
                <span className="composer-chip">
                  {attachments.length}
                  {" "}
                  file
                  {attachments.length >
                  1
                    ? "s"
                    : ""}
                </span>
              )}
            </div>

            <textarea
              ref={
                textareaRef
              }
              value={input}
              onChange={
                handleInputChange
              }
              onKeyDown={
                handleTextareaKeyDown
              }
              placeholder={
                editingId
                  ? "Edit your message…"
                  : "Message OZLIND…"
              }
              rows={1}
              disabled={sending}
            />

            <div className="composer-bottom">
              <div className="composer-tools">
                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  hidden
                  multiple
                  accept={ALLOWED_TYPES.join(
                    ","
                  )}
                  onChange={
                    handleFileSelection
                  }
                />

                <button
                  className="tool-button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  title="Attach image or file"
                  aria-label="Attach image or file"
                  disabled={
                    attachments.length >=
                    MAX_ATTACHMENTS
                  }
                >
                  <Icon
                    name="image"
                    size={17}
                  />
                </button>

                <button
                  className={`tool-button ${
                    settings.research
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setSettings(
                      (current) => ({
                        ...current,
                        research:
                          !current.research,
                        mode:
                          !current.research
                            ? "research"
                            : current.mode ===
                                "research"
                              ? "auto"
                              : current.mode,
                      })
                    )
                  }
                  title="Toggle web research"
                  aria-label="Toggle web research"
                >
                  <Icon
                    name="globe"
                    size={17}
                  />
                </button>

                {renderModeSelector()}
              </div>

              <button
                className={`send-button ${
                  sending
                    ? "stop-button"
                    : ""
                }`}
                onClick={
                  sending
                    ? stopGeneration
                    : sendMessage
                }
                disabled={
                  !sending &&
                  !input.trim()
                }
                aria-label={
                  sending
                    ? "Stop"
                    : "Send"
                }
              >
                <Icon
                  name={
                    sending
                      ? "stop"
                      : "send"
                  }
                  size={17}
                />
              </button>
            </div>
          </div>

          <div className="composer-note">
            OZLIND can make mistakes.
            Verify important information.
          </div>
        </div>
      </section>
    );
  }

  /*
   * History
   */
  function renderHistory() {
    return (
      <section className="secondary-view">
        <div className="secondary-header">
          <div>
            <div className="eyebrow">
              PERSONAL
            </div>

            <h1>
              History
            </h1>
          </div>

          <button
            className="new-chat-button"
            onClick={
              startNewChat
            }
          >
            <Icon
              name="plus"
              size={17}
            />
            New Chat
          </button>
        </div>

        <div className="history-search">
          <Icon
            name="search"
            size={17}
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search conversations…"
          />
        </div>

        <div className="history-list">
          {filteredHistory.length ===
          0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon
                  name="history"
                  size={22}
                />
              </div>

              <h3>
                No conversations yet
              </h3>

              <p>
                Your conversations
                will appear here.
              </p>
            </div>
          ) : (
            filteredHistory.map(
              (item) => (
                <button
                  className="history-card"
                  key={item.id}
                  onClick={() =>
                    openConversation(
                      item
                    )
                  }
                >
                  <div className="history-card-icon">
                    <Icon
                      name="chat"
                      size={17}
                    />
                  </div>

                  <div className="history-card-body">
                    <strong>
                      {item.title ||
                        "New conversation"}
                    </strong>

                    <span>
                      {item.messages
                        ?.length ||
                        0}{" "}
                      messages
                    </span>
                  </div>

                  <Icon
                    name="chevron"
                    size={18}
                  />
                </button>
              )
            )
          )}
        </div>
      </section>
    );
  }

  /*
   * Settings
   */
  function renderSettings() {
    return (
      <section className="secondary-view">
        <div className="secondary-header">
          <div>
            <div className="eyebrow">
              PERSONAL
            </div>

            <h1>
              Settings
            </h1>
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-section">
            <div>
              <strong>
                Conversation memory
              </strong>

              <p>
                Keep recent conversation
                context when OZLIND answers.
              </p>
            </div>

            <button
              className={`switch ${
                settings.memory
                  ? "on"
                  : ""
              }`}
              onClick={() =>
                setSettings(
                  (current) => ({
                    ...current,
                    memory:
                      !current.memory,
                  })
                )
              }
              aria-label="Toggle memory"
            >
              <span />
            </button>
          </div>

          <div className="settings-section">
            <div>
              <strong>
                Web Research
              </strong>

              <p>
                Allow live web research when
                needed or explicitly enabled.
              </p>
            </div>

            <button
              className={`switch ${
                settings.research
                  ? "on"
                  : ""
              }`}
              onClick={() =>
                setSettings(
                  (current) => ({
                    ...current,
                    research:
                      !current.research,
                    mode:
                      !current.research
                        ? "research"
                        : current.mode ===
                            "research"
                          ? "auto"
                          : current.mode,
                  })
                )
              }
              aria-label="Toggle research"
            >
              <span />
            </button>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>
                Intelligence mode
              </strong>

              <p>
                Choose how OZLIND should
                approach the conversation.
              </p>
            </div>

            <div className="mode-grid">
              {MODES.map(
                (mode) => (
                  <button
                    key={mode.id}
                    className={
                      settings.mode ===
                      mode.id
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          mode:
                            mode.id,
                          research:
                            mode.id ===
                            "research",
                        })
                      )
                    }
                  >
                    <strong>
                      {mode.label}
                    </strong>

                    <span>
                      {
                        mode.description
                      }
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>
                Answer length
              </strong>

              <p>
                Control how much detail
                OZLIND uses.
              </p>
            </div>

            <div className="segmented">
              {[
                "short",
                "medium",
                "long",
              ].map(
                (value) => (
                  <button
                    key={value}
                    className={
                      settings.length ===
                      value
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          length:
                            value,
                        })
                      )
                    }
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>
                Response style
              </strong>

              <p>
                Choose the default communication
                style.
              </p>
            </div>

            <div className="segmented wrap">
              {[
                "balanced",
                "professional",
                "friendly",
                "direct",
                "creative",
              ].map(
                (value) => (
                  <button
                    key={value}
                    className={
                      settings.style ===
                      value
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          style:
                            value,
                        })
                      )
                    }
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>
                Custom instructions
              </strong>

              <p>
                Optional preferences for
                how OZLIND should respond.
              </p>
            </div>

            <textarea
              className="settings-textarea"
              value={
                settings.customInstructions
              }
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    customInstructions:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="Example: Keep answers concise and use bullet points when useful."
              maxLength={3000}
            />

            <div className="character-count">
              {
                settings
                  .customInstructions
                  .length
              }
              /3000
            </div>
          </div>
        </div>
      </section>
    );
  }

  /*
   * Boot screen
   */
  if (booting) {
    return (
      <div className="boot-screen">
        <div className="boot-logo">
          <Logo size={30} />
        </div>

        <div className="boot-wordmark">
          OZLIND
        </div>

        <div className="boot-line">
          <span />
        </div>

        <div className="boot-status">
          Initializing intelligence
        </div>
      </div>
    );
  }

  /*
   * Main application
   */
  return (
    <div className="ozlind-shell">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          onClick={() =>
            setSidebarOpen(
              false
            )
          }
          aria-label="Close menu"
        />
      )}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >
        <div className="sidebar-top">
          <button
            className="brand"
            onClick={() => {
              setView("chat");
              setSidebarOpen(
                false
              );
            }}
          >
            <div className="brand-mark">
              <Logo size={20} />
            </div>

            <div className="brand-text">
              <strong>
                OZLIND
              </strong>

              <span>
                AI PLATFORM
              </span>
            </div>
          </button>

          <button
            className="close-sidebar"
            onClick={() =>
              setSidebarOpen(
                false
              )
            }
            aria-label="Close sidebar"
          >
            <Icon
              name="close"
              size={20}
            />
          </button>
        </div>

        <button
          className="sidebar-new-chat"
          onClick={
            startNewChat
          }
        >
          <Icon
            name="plus"
            size={18}
          />

          <span>
            New Chat
          </span>

          <kbd>
            ⌘ N
          </kbd>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-label">
            WORKSPACE
          </div>

          <button
            className={`nav-item ${
              view === "chat"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setView("chat");
              setSidebarOpen(
                false
              );
            }}
          >
            <span className="nav-icon">
              <Icon
                name="chat"
                size={17}
              />
            </span>

            <span>
              AI Chat
            </span>

            <span className="live-dot">
              LIVE
            </span>
          </button>

          <div className="nav-label personal-label">
            PERSONAL
          </div>

          <button
            className={`nav-item ${
              view ===
              "history"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setView(
                "history"
              );
              setSidebarOpen(
                false
              );
            }}
          >
            <span className="nav-icon">
              <Icon
                name="history"
                size={17}
              />
            </span>

            <span>
              History
            </span>
          </button>

          <button
            className={`nav-item ${
              view ===
              "settings"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setView(
                "settings"
              );
              setSidebarOpen(
                false
              );
            }}
          >
            <span className="nav-icon">
              <Icon
                name="settings"
                size={17}
              />
            </span>

            <span>
              Settings
            </span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="profile-avatar">
              A
            </div>

            <div className="profile-copy">
              <strong>
                Athul
              </strong>

              <span>
                OZLIND User
              </span>
            </div>

            <span className="profile-more">
              •••
            </span>
          </div>

          <div className="sidebar-version">
            OZLIND AI{" "}
            <span>
              v1
            </span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="top-menu"
            onClick={() =>
              setSidebarOpen(
                true
              )
            }
            aria-label="Open menu"
          >
            <Icon
              name="menu"
              size={20}
            />
          </button>

          <div className="topbar-title">
            {conversation.title ===
            "New conversation"
              ? "OZLIND"
              : conversation.title}
          </div>

          <div className="topbar-status">
            <span className="status-dot" />
            <span>
              Online
            </span>
          </div>
        </header>

        <div className="workspace">
          {view ===
            "chat" &&
            renderChat()}

          {view ===
            "history" &&
            renderHistory()}

          {view ===
            "settings" &&
            renderSettings()}
        </div>
      </main>

      {notice && (
        <div className="toast">
          <Icon
            name="check"
            size={15}
          />

          {notice}
        </div>
      )}
    </div>
  );
    }
