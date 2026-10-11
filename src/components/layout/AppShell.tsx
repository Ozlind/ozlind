"use client";

import { useEffect, useRef, useState } from "react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePreferences } from "@/hooks/usePreferences";

export function AppShell({ user, children }: { user: { id: string; email: string; displayName: string }; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { preferences } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = preferences.density;
    root.dataset.layout = preferences.layout;
    root.style.setProperty("--accent", preferences.accent);
    root.style.setProperty("--accent-fg", "#fff");

    const applyTheme = () => {
      const dark = preferences.theme === "dark" || (preferences.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };

    applyTheme();
    if (preferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [preferences]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="app-shell">
      <Sidebar user={user} mobileOpen={open} onClose={() => setOpen(false)} />
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => { setOpen(false); menuButtonRef.current?.focus(); }}
          aria-label="Close navigation"
        />
      )}
      <div className="app-main">
        <button
          ref={menuButtonRef}
          type="button"
          className="mobile-menu"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="sidebar-navigation"
        >
          <OzlindIcon name="i-menu" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
