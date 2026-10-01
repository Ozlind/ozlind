import type {
  ChatRequestBody,
  Source,
  StreamEvent,
} from "@/types/chat";

export interface ChatStreamHandlers {
  onReady?: () => void;
  onNotice?: (message: string) => void;
  onDelta?: (content: string) => void;
  onSources?: (sources: Source[]) => void;
  onMeta?: (provider: string, model: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

export interface ChatStreamResult {
  provider: string | null;
  model: string | null;
  completed: boolean;
}

function parseEventBlock(block: string): StreamEvent | null {
  const lines = block.split("\n");

  let eventName = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  if (!data) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(data);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("type" in parsed)
    ) {
      return null;
    }

    const event = parsed as StreamEvent;

    if (!eventName) {
      return event;
    }

    return event;
  } catch {
    return null;
  }
}

function dispatchEvent(
  event: StreamEvent,
  handlers: ChatStreamHandlers,
): void {
  switch (event.type) {
    case "ready":
      handlers.onReady?.();
      break;

    case "notice":
      handlers.onNotice?.(event.message);
      break;

    case "delta":
      handlers.onDelta?.(event.content);
      break;

    case "sources":
      handlers.onSources?.(event.sources);
      break;

    case "meta":
      handlers.onMeta?.(
        event.provider,
        event.model,
      );
      break;

    case "done":
      handlers.onDone?.();
      break;

    case "error":
      handlers.onError?.(event.error);
      break;

    default: {
      const exhaustiveCheck: never = event;
      return exhaustiveCheck;
    }
  }
}

export async function streamChat(
  body: ChatRequestBody,
  handlers: ChatStreamHandlers = {},
  signal?: AbortSignal,
): Promise<ChatStreamResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const json: unknown = await response.json();

      if (
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof json.error === "string"
      ) {
        message = json.error;
      }
    } catch {
      // Keep the generic HTTP error.
    }

    handlers.onError?.(message);
    throw new Error(message);
  }

  if (!response.body) {
    const message = "The server returned an empty response.";
    handlers.onError?.(message);
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let provider: string | null = null;
  let model: string | null = null;
  let completed = false;

  const processBuffer = (flush: boolean): void => {
    const separator = "\n\n";

    while (true) {
      const index = buffer.indexOf(separator);

      if (index === -1) {
        break;
      }

      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + separator.length);

      const event = parseEventBlock(block);

      if (!event) {
        continue;
      }

      if (event.type === "meta") {
        provider = event.provider;
        model = event.model;
      }

      if (event.type === "done") {
        completed = true;
      }

      dispatchEvent(event, handlers);
    }

    if (flush && buffer.trim()) {
      const event = parseEventBlock(buffer);

      if (event) {
        if (event.type === "meta") {
          provider = event.provider;
          model = event.model;
        }

        if (event.type === "done") {
          completed = true;
        }

        dispatchEvent(event, handlers);
      }

      buffer = "";
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        processBuffer(true);
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      processBuffer(false);
    }
  } finally {
    reader.releaseLock();
  }

  return {
    provider,
    model,
    completed,
  };
}