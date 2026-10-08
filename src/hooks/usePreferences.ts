"use client";

import { useCallback, useEffect, useState } from "react";

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
};

export const defaultPreferences: Preferences = {
  theme: "system",
  accent: "#E26F4A",
  language: "en",
  density: "comfortable",
  code_theme: "default",
  layout: "standard",
  default_model: "groq:llama-3.3-70b-versatile",
  enter_to_send: true,
  auto_scroll: true,
  show_reasoning: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load preferences.");
        const body = await response.json();
        setPreferences({ ...defaultPreferences, ...body.preferences });
      })
      .catch(() => setPreferences(defaultPreferences))
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(async (patch: Partial<Preferences>) => {
    setSaving(true);
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  return { preferences, setPreferences, update, loading, saving };
}
