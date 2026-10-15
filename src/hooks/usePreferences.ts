"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Preferences = {
  theme: "system" | "light" | "dark";
  accent: string;
  language: "en" | "ml";
  density: "compact" | "comfortable" | "spacious";
  code_theme: string;
  layout: "standard" | "wide";
  default_model: "groq:llama-3.3-70b-versatile" | "groq:deepseek-r1-distill-llama-70b" | "google:gemini-2.0-flash";
  enter_to_send: boolean;
  auto_scroll: boolean;
  show_reasoning: boolean;
  research_enabled: boolean;
};

export const defaultPreferences: Preferences = {
  theme: "system",
  accent: "#5B63E8",
  language: "en",
  density: "comfortable",
  code_theme: "default",
  layout: "standard",
  default_model: "groq:llama-3.3-70b-versatile",
  enter_to_send: true,
  auto_scroll: true,
  show_reasoning: false,
  research_enabled: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const requestVersion = useRef(0);
  const pendingSaves = useRef(0);

  useEffect(() => {
    let active = true;
    fetch("/api/preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load preferences.");
        const body = await response.json();
        if (active) setPreferences({ ...defaultPreferences, ...body.preferences });
      })
      .catch(() => {
        if (active) setSaveError("Your saved preferences could not be loaded. Changes may not match your last session.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const update = useCallback(async (patch: Partial<Preferences>) => {
    const previous = preferences;
    const version = ++requestVersion.current;
    const next = { ...previous, ...patch };
    setPreferences(next);
    setSaveError("");
    pendingSaves.current += 1;
    setSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not save preferences.");
      }
    } catch {
      if (version === requestVersion.current) {
        setPreferences(previous);
        setSaveError("Your change could not be saved. Check your connection and try again.");
      }
    } finally {
      pendingSaves.current = Math.max(0, pendingSaves.current - 1);
      setSaving(pendingSaves.current > 0);
    }
  }, [preferences]);

  return { preferences, setPreferences, update, loading, saving, saveError, clearSaveError: () => setSaveError("") };
}
