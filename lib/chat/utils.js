import { DEFAULT_SETTINGS } from "@/constants/settings";
import { LIMITS, TEXT_FILE_PATTERN } from "@/constants/limits";

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

export function normalizeSettings(raw) {
  const result = { ...DEFAULT_SETTINGS };

  if (!raw || typeof raw !== "object") {
    return result;
  }

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof raw[key] === typeof DEFAULT_SETTINGS[key]) {
      result[key] = raw[key];
    }
  }

  return result;
}

export function isHistoryRecord(item) {
  return Boolean(
    item &&
      typeof item.id === "string" &&
      typeof item.title === "string",
  );
}

export function createTitle(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "New conversation";

  return text.length > 52
    ? `${text.slice(0, 52).trim()}…`
    : text;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isTextFile(file) {
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    TEXT_FILE_PATTERN.test(file.name)
  );
}

export async function readTextFile(file) {
  const text = await file.text();

  return text.length > MAX_TEXT_FILE_CHARS
    ? `${text.slice(0, MAX_TEXT_FILE_CHARS)}\n…[file truncated]`
    : text;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read the image."));

    reader.readAsDataURL(file);
  });
}

export async function optimizeImage(file) {
  const original = await fileToDataUrl(file);

  if (
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return original;
  }

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = original;
    });

    const maxSide = 1600;
    const scale = Math.min(
      1,
      maxSide / Math.max(image.width, image.height),
    );

    if (
      scale === 1 &&
      file.size < 1.5 * 1024 * 1024
    ) {
      return original;
    }

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(
      1,
      Math.round(image.width * scale),
    );

    canvas.height = Math.max(
      1,
      Math.round(image.height * scale),
    );

    const context = canvas.getContext("2d");

    if (!context) {
      return original;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return original;
  }
}

export async function makeThumbnail(dataUrl) {
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = dataUrl;
    });

    const maxSide = 480;
    const scale = Math.min(
      1,
      maxSide / Math.max(image.width, image.height),
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(
      1,
      Math.round(image.width * scale),
    );

    canvas.height = Math.max(
      1,
      Math.round(image.height * scale),
    );

    const context = canvas.getContext("2d");

    if (!context) return null;

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const output = canvas.toDataURL(
      "image/jpeg",
      0.6,
    );

    return output.length < 150000
      ? output
      : null;
  } catch {
    return null;
  }
}

export function getMessageText(message) {
  if (!message) return "";

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) =>
        typeof part === "string"
          ? part
          : part?.text || "",
      )
      .join("");
  }

  return "";
}

export function stripAttachmentData(message) {
  if (!message?.attachment) {
    return message;
  }

  const { dataUrl, ...attachment } =
    message.attachment;

  return {
    ...message,
    attachment,
  };
}

export function withoutThumbnails(item) {
  if (!Array.isArray(item?.messages)) {
    return item;
  }

  return {
    ...item,
    messages: item.messages.map((message) => {
      if (!message?.attachment?.thumb) {
        return message;
      }

      const { thumb, ...attachment } =
        message.attachment;

      return {
        ...message,
        attachment,
      };
    }),
  };
}

export function buildApiMessages(messages) {
  let lastImageIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const attachment = messages[index]?.attachment;

    if (
      attachment?.type?.startsWith("image/") &&
      (attachment.dataUrl || attachment.thumb)
    ) {
      lastImageIndex = index;
      break;
    }
  }

  return messages.map((message, index) => {
    const text = getMessageText(message);
    const attachment = message.attachment;

    const imageUrl =
      attachment?.dataUrl ||
      attachment?.thumb;

    if (
      imageUrl &&
      attachment?.type?.startsWith("image/")
    ) {
      const content = [];

      if (text) {
        content.push({
          type: "text",
          text,
        });
      }

      if (index === lastImageIndex) {
        content.push({
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        });
      } else {
        content.push({
          type: "text",
          text: `[Earlier image: ${attachment.name}]`,
        });
      }

      return {
        role: message.role,
        content,
      };
    }

    if (attachment?.text) {
      return {
        role: message.role,
        content:
          `${text}\n\n` +
          `[Attached file: ${attachment.name}]\n` +
          "```\n" +
          attachment.text +
          "\n```",
      };
    }

    if (attachment?.name) {
      return {
        role: message.role,
        content:
          `${text}\n\n` +
          `[Earlier attachment: ${attachment.name} — no longer available]`,
      };
    }

    return {
      role: message.role,
      content: text,
    };
  });
}

export function hasImagePart(messages) {
  return messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some(
        (part) =>
          part?.type === "image_url" &&
          typeof part?.image_url?.url === "string" &&
          part.image_url.url.startsWith(
            "data:image/",
          ),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function AccountRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
  onClick,
}) {
  return (
    <button
      type="button"
      className="account-row"
      onClick={onClick}
    >
      <span className="account-row-icon">
        {Icon ? (
          <Icon
            size={20}
            strokeWidth={1.8}
          />
        ) : null}
      </span>

      <span className="account-row-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </span>

      {trailing || (
        <ChevronRight
          size={18}
          className="account-row-chevron"
        />
      )}
    </button>
  );
}

function AccountGroup({ title, children }) {
  return (
    <section className="account-group">
      <h2>{title}</h2>
      <div className="account-group-card">
        {children}
      </div>
    </section>
  );
}

function Switch({ checked }) {
  return (
    <span
      className={`account-switch ${
        checked ? "active" : ""
      }`}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}



export const MAX_TEXT_FILE_CHARS = LIMITS.maxTextFileChars;
export const MAX_IMAGE_BYTES = LIMITS.maxImageBytes;
export const MAX_TEXT_BYTES = LIMITS.maxTextFileBytes;
