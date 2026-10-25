"use client";

import { useState } from "react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { buildConversationMarkdown, suggestArtifactTitle, type ExportableMessage } from "@/lib/chat/export.mjs";

type ChatUtilityMessage = ExportableMessage & { status?: string };

export function ChatUtilities({
  conversationId,
  messages,
  streaming,
}: {
  conversationId?: string;
  messages: ChatUtilityMessage[];
  streaming: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  const hasMessages = messages.some((message) => message.content.trim() || (message.images && message.images.length));

  function exportTranscript() {
    if (!hasMessages) return;
    const title = suggestArtifactTitle(messages);
    const markdown = buildConversationMarkdown(messages, title);
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) + ".md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    setFeedback("Markdown export downloaded.");
    setFeedbackError(false);
  }

  async function saveTranscript() {
    if (!hasMessages || saving) return;
    setSaving(true);
    setFeedback("");
    setFeedbackError(false);

    try {
      const title = suggestArtifactTitle(messages);
      const markdown = buildConversationMarkdown(messages, title);
      if (markdown.length > 100000) {
        throw new Error("This conversation is too large for one Workspace item. Export it as Markdown instead.");
      }

      const response = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          kind: "markdown",
          content: markdown,
          version: 1,
          conversation_id: conversationId || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in again to save this conversation.");
        throw new Error(payload?.error?.message || "Conversation could not be saved. Try again.");
      }

      setFeedback("Conversation saved to Workspace.");
      setFeedbackError(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Conversation could not be saved.");
      setFeedbackError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="chat-header-tools">
      <button type="button" className="chat-header-tool" onClick={exportTranscript} disabled={!hasMessages || streaming} title="Download this conversation as Markdown" aria-label="Export conversation as Markdown">
        <OzlindIcon name="i-download" size={15} />
        <span>Export</span>
      </button>
      <button type="button" className="chat-header-tool" onClick={() => void saveTranscript()} disabled={!hasMessages || streaming || saving} title="Save this conversation to your Workspace" aria-label="Save conversation to Workspace">
        <OzlindIcon name={saving ? "sym-processing" : "i-documents"} size={15} className={saving ? "workspace-spin" : undefined} />
        <span>{saving ? "Saving…" : "Save chat"}</span>
      </button>
      {feedback && <span className={feedbackError ? "chat-header-feedback error" : "chat-header-feedback"} role={feedbackError ? "alert" : "status"}>{feedback}</span>}
    </div>
  );
}
