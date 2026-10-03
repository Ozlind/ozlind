"use client";

import { createClient } from "@/lib/supabase/client";

/*
 * Browser-side helpers that save and load OZLIND conversations in the
 * signed-in user's Supabase account. Row level security guarantees that
 * every query only ever touches the current user's own rows.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
 * Makes an older local conversation safe to store: every id must be a UUID
 * and only real user/assistant text messages are kept.
 */
export function prepareForCloud(item) {
  const messages = (Array.isArray(item?.messages) ? item.messages : [])
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .map((message) => ({
      ...message,
      id: isUuid(message.id) ? message.id : newId(),
    }));

  return {
    ...item,
    id: isUuid(item?.id) ? item.id : newId(),
    title: String(item?.title || "New conversation").slice(0, 120),
    updatedAt: Number(item?.updatedAt) || Date.now(),
    messages,
  };
}

/**
 * Saves one conversation. `synced` is the set of message ids already stored,
 * so only new messages are sent and removed messages are deleted.
 * Returns the new set of stored message ids.
 */
export async function saveConversation({
  userId,
  conversationId,
  title,
  updatedAt,
  messages,
  synced,
}) {
  const supabase = await createClient();

  const { error: conversationError } = await supabase
    .from("conversations")
    .upsert(
      {
        id: conversationId,
        user_id: userId,
        title: String(title || "New conversation").slice(0, 120),
        updated_at: new Date(updatedAt || Date.now()).toISOString(),
      },
      { onConflict: "id" },
    );

  if (conversationError) throw conversationError;

  const known = synced instanceof Set ? synced : new Set();
  const currentIds = new Set(messages.map((message) => message.id));
  const removed = Array.from(known).filter((id) => !currentIds.has(id));

  if (removed.length) {
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .in("id", removed);

    if (deleteError) throw deleteError;
  }

  const rows = [];
  let lastTimestamp = 0;

  for (const message of messages) {
    let timestamp = Number(message.createdAt) || Date.now();

    // Keep a strict order even if two messages share the same millisecond.
    if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
    lastTimestamp = timestamp;

    if (known.has(message.id)) continue;

    rows.push({
      id: message.id,
      conversation_id: conversationId,
      user_id: userId,
      role: message.role,
      content: message.content,
      attachment: message.attachment || null,
      sources: Array.isArray(message.sources) ? message.sources : [],
      created_at: new Date(timestamp).toISOString(),
    });
  }

  if (rows.length) {
    const { error: insertError } = await supabase
      .from("messages")
      .upsert(rows, { onConflict: "id" });

    if (insertError) throw insertError;
  }

  return currentIds;
}

export async function fetchMessages(conversationId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, attachment, sources, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) throw error;

  return (data || []).map((row) => cleanMessage(fromMessageRow(row)));
}

export async function deleteConversation(conversationId) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw error;
}

export async function deleteAllConversations(userId) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

export async function saveSettings(userId, settings) {
  const supabase = await createClient();

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function deleteSettings(userId) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_settings")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

/** Every conversation with all of its messages, for the data export. */
export async function fetchEverything() {
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw error;

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

  for (let from = 0; from < 20000; from += pageSize) {
    const { data: rows, error: messageError } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, role, content, attachment, sources, created_at",
      )
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (messageError) throw messageError;

    for (const row of rows || []) {
      byConversation.get(row.conversation_id)?.messages.push({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        attachment: row.attachment || null,
        sources: Array.isArray(row.sources) ? row.sources : [],
      });
    }

    if (!rows || rows.length < pageSize) break;
  }

  return Array.from(byConversation.values());
}