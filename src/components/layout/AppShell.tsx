"use client";

import { useEffect, useState } from "react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePreferences } from "@/hooks/usePreferences";

type ShellUser = { id: string; email: string; displayName: string };

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { preferences } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = preferences.density;
    root.dataset.layout = preferences.layout;
    root.style.setProperty("--accent", preferences.accent);
    root.style.setProperty("--accent-fg", "#f5f5f7");

    const applyTheme = () => {
      const dark =
        preferences.theme === "dark" ||
        (preferences.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-drawer-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <Sidebar user={user} mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="app-main">
        <button
          className="mobile-menu"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open sidebar"
          aria-expanded={open}
          aria-controls="ozlind-sidebar"
        >
          <OzlindIcon name="i-menu" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
