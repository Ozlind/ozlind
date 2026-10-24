"use client";

import { useState } from "react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { suggestArtifactTitle } from "@/lib/chat/export.mjs";

export function SaveResponseButton({ content }: { content: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save() {
    if (!content.trim() || state === "saving" || state === "saved") return;
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestArtifactTitle([{ role: "user", content }], "Answer"),
          kind: "markdown",
          content,
          version: 1,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in again to save this answer.");
        throw new Error(payload?.error?.message || "This answer could not be saved. Try again.");
      }

      setState("saved");
      setMessage("Saved to Workspace.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "This answer could not be saved.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="message-action"
        onClick={() => void save()}
        disabled={state === "saving" || state === "saved"}
        aria-label={state === "saved" ? "Answer saved to Workspace" : "Save answer to Workspace"}
        title="Keep this answer in your Workspace"
      >
        <OzlindIcon
          name={state === "saved" ? "i-check" : state === "saving" ? "sym-processing" : "i-documents"}
          size={14}
          className={state === "saving" ? "workspace-spin" : undefined}
        />
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
      </button>
      <span className={state === "error" ? "message-save-error" : "visually-hidden"} role={state === "error" ? "alert" : "status"}>{message}</span>
    </>
  );
}
