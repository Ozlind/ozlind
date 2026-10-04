"use client";

import { createClient } from "@/lib/supabase/client";

/*
 * Browser-side helpers for OZLIND conversation persistence.
 *
 * Responsibilities:
 * - Persist conversations/messages for the signed-in user.
 * - Keep local message IDs compatible with Supabase UUID columns.
 * - Avoid invalid/empty messages reaching the database.
 * - Keep message ordering stable.
 * - Keep cloud synchronization resilient when a message changes.
 *
 * Supabase RLS remains the primary ownership/security boundary.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGES_PER_CONVERSATION = 1000;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random UUID generation is unavailable.");
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];

  return sources
    .filter((source) => source && typeof source === "object")
    .slice(0, 20)
    .map((source) => ({
      title:
        typeof source.title === "string"
          ? source.title.slice(0, 500)
          : "",
      url:
        typeof source.url === "string"
          ? source.url.slice(0, 2000)
          : "",
      domain:
        typeof source.domain === "string"
          ? source.domain.slice(0, 300)
          : "",
    }))
    .filter((source) => source.title || source.url || source.domain);
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  return {
    name:
      typeof attachment.name === "string"
        ? attachment.name.slice(0, 255)
        : "",
    type:
      typeof attachment.type === "string"
        ? attachment.type.slice(0, 150)
        : "",
    size: Number.isFinite(Number(attachment.size))
      ? Math.max(0, Number(attachment.size))
      : 0,
    dataUrl:
      typeof attachment.dataUrl === "string"
        ? attachment.dataUrl
        : null,
    thumb:
      typeof attachment.thumb === "string"
        ? attachment.thumb
        : null,
    text:
      typeof attachment.text === "string"
        ? attachment.text
        : null,
  };
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") return null;

  const role =
    message.role === "user" || message.role === "assistant"
      ? message.role
      : null;

  if (!role) return null;

  if (typeof message.content !== "string") return null;

  const content = message.content.trim();

  if (!content) return null;

  return {
    ...message,
    id: isUuid(message.id) ? message.id : newId(),
    role,
    content,
    createdAt: Number(message.createdAt) || Date.now(),
    attachment: normalizeAttachment(message.attachment),
    sources: normalizeSources(message.sources),
  };
}

function fromMessageRow(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: Date.parse(row.created_at) || Date.now(),
    attachment: row.attachment || null,
    sources: Array.isArray(row.sources) ? row.sources : [],
    conversationId: row.conversation_id,
  };
}

function cleanMessage(row) {
  const { conversationId, ...message } = row;
  return message;
}

/**
 * Converts a local conversation into a Supabase-safe representation.
 *
 * Important:
 * - Only user/assistant messages are persisted.
 * - Every conversation/message ID is a UUID.
 * - Empty messages are discarded.
 * - Duplicate message IDs are removed.
 */
export function prepareForCloud(item) {
  const sourceMessages = Array.isArray(item?.messages)
    ? item.messages
    : [];

  const seenIds = new Set();
  const messages = [];

  for (const sourceMessage of sourceMessages) {
    const message = normalizeMessage(sourceMessage);

    if (!message) continue;

    if (seenIds.has(message.id)) {
      continue;
    }

    seenIds.add(message.id);
    messages.push(message);
  }

  return {
    ...item,
    id: isUuid(item?.id) ? item.id : newId(),
    title: String(item?.title || "New conversation")
      .trim()
      .slice(0, MAX_TITLE_LENGTH),
    updatedAt: Number(item?.updatedAt) || Date.now(),
    messages: messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
}

/**
 * Saves one conversation and synchronizes its messages.
 *
 * `synced` is the set of IDs previously known to exist in Supabase.
 *
 * Unlike the previous implementation, existing message IDs are also
 * upserted. This matters when a streaming assistant message is updated
 * or a local message changes before synchronization finishes.
 */
export async function saveConversation({
  userId,
  conversationId,
  title,
  updatedAt,
  messages,
  synced,
}) {
  if (!isUuid(userId)) {
    throw new Error("Invalid user account identifier.");
  }

  if (!isUuid(conversationId)) {
    throw new Error("Invalid conversation identifier.");
  }

  const supabase = await createClient();

  const normalizedMessages = [];
  const seenIds = new Set();

  for (const rawMessage of Array.isArray(messages) ? messages : []) {
    const message = normalizeMessage(rawMessage);

    if (!message) continue;

    if (seenIds.has(message.id)) {
      continue;
    }

    seenIds.add(message.id);
    normalizedMessages.push(message);
  }

  const finalMessages = normalizedMessages.slice(
    -MAX_MESSAGES_PER_CONVERSATION,
  );

  const { error: conversationError } = await supabase
    .from("conversations")
    .upsert(
      {
        id: conversationId,
        user_id: userId,
        title: String(title || "New conversation")
          .trim()
          .slice(0, MAX_TITLE_LENGTH),
        updated_at: new Date(
          Number(updatedAt) || Date.now(),
        ).toISOString(),
      },
      {
        onConflict: "id",
      },
    );

  if (conversationError) {
    throw conversationError;
  }

  const known =
    synced instanceof Set
      ? synced
      : new Set();

  const currentIds = new Set(
    finalMessages.map((message) => message.id),
  );

  /*
   * Remove cloud messages that no longer exist locally.
   */
  const removed = Array.from(known).filter(
    (id) => isUuid(id) && !currentIds.has(id),
  );

  if (removed.length) {
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .in("id", removed);

    if (deleteError) {
      throw deleteError;
    }
  }

  /*
   * Upsert all current messages.
   *
   * This intentionally does not rely exclusively on `synced`.
   * If an already-synced message changes locally, the latest content
   * must reach Supabase as well.
   */
  const rows = [];
  let lastTimestamp = 0;

  for (const message of finalMessages) {
    let timestamp =
      Number(message.createdAt) || Date.now();

    if (timestamp <= lastTimestamp) {
      timestamp = lastTimestamp + 1;
    }

    lastTimestamp = timestamp;

    rows.push({
      id: message.id,
      conversation_id: conversationId,
      user_id: userId,
      role: message.role,
      content: message.content,
      attachment: message.attachment || null,
      sources: normalizeSources(message.sources),
      created_at: new Date(timestamp).toISOString(),
    });
  }

  if (rows.length) {
    const { error: insertError } = await supabase
      .from("messages")
      .upsert(rows, {
        onConflict: "id",
      });

    if (insertError) {
      throw insertError;
    }
  }

  return currentIds;
}

export async function fetchMessages(conversationId) {
  if (!isUuid(conversationId)) {
    throw new Error("Invalid conversation identifier.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, role, content, attachment, sources, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", {
      ascending: true,
    })
    .limit(MAX_MESSAGES_PER_CONVERSATION);

  if (error) {
    throw error;
  }

  return (data || []).map((row) =>
    cleanMessage(fromMessageRow(row)),
  );
}

export async function deleteConversation(conversationId) {
  if (!isUuid(conversationId)) {
    throw new Error("Invalid conversation identifier.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    throw error;
  }
}

export async function deleteAllConversations(userId) {
  if (!isUuid(userId)) {
    throw new Error("Invalid user account identifier.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function saveSettings(userId, settings) {
  if (!isUuid(userId)) {
    throw new Error("Invalid user account identifier.");
  }

  const supabase = await createClient();

  const safeSettings =
    settings && typeof settings === "object"
      ? settings
      : {};

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        settings: safeSettings,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    throw error;
  }
}

export async function deleteSettings(userId) {
  if (!isUuid(userId)) {
    throw new Error("Invalid user account identifier.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/**
 * Returns every conversation with its messages for data export.
 */
export async function fetchEverything() {
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      "id, title, created_at, updated_at",
    )
    .order("updated_at", {
      ascending: false,
    })
    .limit(500);

  if (error) {
    throw error;
  }

  const byConversation = new Map(
    (conversations || []).map((conversation) => [
      conversation.id,
      {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: [],
      },
    ]),
  );

  const pageSize = 1000;

  for (
    let from = 0;
    from < 20000;
    from += pageSize
  ) {
    const { data: rows, error: messageError } =
      await supabase
        .from("messages")
        .select(
          "id, conversation_id, role, content, attachment, sources, created_at",
        )
        .order("created_at", {
          ascending: true,
        })
        .range(
          from,
          from + pageSize - 1,
        );

    if (messageError) {
      throw messageError;
    }

    for (const row of rows || []) {
      const conversation =
        byConversation.get(row.conversation_id);

      if (!conversation) continue;

      conversation.messages.push({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        attachment: row.attachment || null,
        sources: Array.isArray(row.sources)
          ? row.sources
          : [],
      });
    }

    if (!rows || rows.length < pageSize) {
      break;
    }
  }

  return Array.from(byConversation.values());
}