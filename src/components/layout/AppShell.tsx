"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePreferences } from "@/hooks/usePreferences";

export function AppShell({ user, children }: { user: { id: string; email: string; displayName: string }; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { preferences } = usePreferences();

  const closeNavigation = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

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
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncKeyboardOffset = () => {
      const heightDifference = window.innerHeight - viewport.height;
      const keyboardIsOpen = heightDifference > 120;
      const offset = keyboardIsOpen
        ? Math.max(0, heightDifference - viewport.offsetTop)
        : 0;

      document.documentElement.style.setProperty("--ozlind-keyboard-offset", `${offset}px`);
    };

    syncKeyboardOffset();
    viewport.addEventListener("resize", syncKeyboardOffset);
    viewport.addEventListener("scroll", syncKeyboardOffset);
    window.addEventListener("resize", syncKeyboardOffset);

    return () => {
      viewport.removeEventListener("resize", syncKeyboardOffset);
      viewport.removeEventListener("scroll", syncKeyboardOffset);
      window.removeEventListener("resize", syncKeyboardOffset);
      document.documentElement.style.removeProperty("--ozlind-keyboard-offset");
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById("sidebar-navigation")?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNavigation(true);
      if (event.key === "Tab") {
        const sidebar = document.getElementById("sidebar-navigation");
        if (!sidebar) return;
        const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.offsetParent !== null);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeNavigation]);

  return (
    <div className="app-shell">
      <Sidebar user={user} mobileOpen={open} onClose={() => closeNavigation(false)} />
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => closeNavigation(true)}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}
      <div className="app-main">
        <button
          ref={menuButtonRef}
          type="button"
          className="mobile-menu"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="sidebar-navigation"
        >
          <OzlindIcon name={open ? "i-close" : "i-menu"} size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
