"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { OzlindIcon } from "@/components/ui/OzlindIcon";

const commands = [
  { id: "new-chat", label: "Start a new chat", description: "Open a clean conversation", href: "/app", icon: "i-new-conversation" },
  { id: "workspace", label: "Open Workspace", description: "Presets and saved answers", href: "/app/workspace", icon: "i-home" },
  { id: "documents", label: "Open Documents", description: "Manage your reference files", href: "/app/documents", icon: "i-documents" },
  { id: "settings", label: "Open Settings", description: "Appearance and chat preferences", href: "/app/settings", icon: "i-settings" },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      (command.label + " " + command.description).toLocaleLowerCase().includes(needle),
    );
  }, [query]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          setOpen(false);
          setQuery("");
        } else {
          previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => previousFocus.current?.focus());
    };
  }, [open]);

  function closePalette() {
    setOpen(false);
    setQuery("");
  }

  function execute(href: string) {
    closePalette();
    router.push(href);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => filteredCommands.length ? (current + 1) % filteredCommands.length : 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => filteredCommands.length ? (current - 1 + filteredCommands.length) % filteredCommands.length : 0);
      return;
    }
    if (event.key === "Enter" && filteredCommands[activeIndex]) {
      event.preventDefault();
      execute(filteredCommands[activeIndex].href);
      return;
    }
    if (event.key === "Tab") {
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'input:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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
  }

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closePalette(); }}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" onKeyDown={handleDialogKeyDown}>
        <div className="command-palette-search">
          <OzlindIcon name="i-search" size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            placeholder="Where do you want to go?"
            aria-label="Search Ozlind commands"
            aria-controls="command-palette-results"
            aria-activedescendant={filteredCommands[activeIndex] ? "command-" + filteredCommands[activeIndex].id : undefined}
          />
          <span className="command-palette-escape">Esc</span>
        </div>
        <div className="command-palette-body">
          <p id="command-palette-title" className="command-palette-label">Quick navigation</p>
          <div id="command-palette-results" role="listbox" aria-label="Available commands">
            {filteredCommands.map((command, index) => (
              <button
                type="button"
                role="option"
                id={"command-" + command.id}
                aria-selected={index === activeIndex}
                key={command.id}
                className={index === activeIndex ? "command-palette-option active" : "command-palette-option"}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => execute(command.href)}
              >
                <span className="command-palette-option-icon"><OzlindIcon name={command.icon} size={17} aria-hidden="true" /></span>
                <span className="command-palette-option-copy"><strong>{command.label}</strong><small>{command.description}</small></span>
                {command.id === "new-chat" && <span className="command-palette-enter">↵</span>}
              </button>
            ))}
            {filteredCommands.length === 0 && <p className="command-palette-empty">No matching destinations. Try “workspace” or “settings”.</p>}
          </div>
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Ctrl</kbd><kbd>K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  );
}
