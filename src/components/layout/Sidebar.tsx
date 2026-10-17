"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useEffect, useRef, useState } from "react";

type SidebarProps = {
  user: { id: string; email: string; displayName: string };
  mobileOpen: boolean;
  onClose: () => void;
};

function conversationGroup(updatedAt: string | null | undefined): "Today" | "Yesterday" | "Previous 7 days" | "Older" {
  const timestamp = updatedAt ? new Date(updatedAt) : new Date(0);
  if (!Number.isFinite(timestamp.getTime())) return "Older";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  const difference = Math.floor((today.getTime() - day.getTime()) / 86_400_000);
  if (difference <= 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference <= 7) return "Previous 7 days";
  return "Older";
}

function highlightedTitle(title: string, query: string) {
  if (!query) return title;
  const index = title.toLocaleLowerCase().indexOf(query);
  if (index < 0) return title;
  return (
    <>
      {title.slice(0, index)}
      <mark className="conversation-search-match">{title.slice(index, index + query.length)}</mark>
      {title.slice(index + query.length)}
    </>
  );
}

export function Sidebar({ user, mobileOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const path = usePathname();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const focusSearch = () => requestAnimationFrame(() => searchInputRef.current?.focus());
    window.addEventListener("ozlind:focus-chat-search", focusSearch);
    return () => window.removeEventListener("ozlind:focus-chat-search", focusSearch);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const {
    data: conversations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["conversations", user.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .select("id,title,updated_at")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
  });

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.assign("/login");
    } catch {
      setSignOutError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredConversations = conversations.filter((conversation) =>
    (conversation.title || "New conversation")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
  const conversationGroups = (["Today", "Yesterday", "Previous 7 days", "Older"] as const)
    .map(label => ({
      label,
      items: filteredConversations.filter(conversation => conversationGroup(conversation.updated_at) === label),
    }))
    .filter(group => group.items.length > 0);

  return (
    <aside
      id="sidebar-navigation"
      className={"sidebar " + (mobileOpen ? "sidebar-open" : "")}
      aria-label="Main navigation"
      aria-hidden={isMobile && !mobileOpen}
      inert={isMobile && !mobileOpen}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <Link href="/app" className="sidebar-brand-link" onClick={onClose} aria-label="Ozlind home">
            <OzlindIcon name="ozl-mark" size={32} aria-hidden="true" className="sidebar-logo-icon" />
            <span>Ozlind</span>
          </Link>
          <button
            type="button"
            className="icon-button mobile-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <OzlindIcon name="i-close" size={20} />
          </button>
        </div>

        <Button title="New chat · Ctrl/⌘ + Alt + N" onClick={() => { router.push("/app"); onClose(); }}>
          <OzlindIcon name="i-new-conversation" size={18} />
          New chat
        </Button>

        <label className="search-box">
          <OzlindIcon name="i-search" size={16} />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search your chats (Ctrl or Command + K)"
            title="Search chats · Ctrl/⌘ + K"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear conversation search"
            >
              <OzlindIcon name="i-clear" size={15} />
            </button>
          )}
        </label>
      </div>

      <nav className="conversation-list" aria-label="Conversation history">
        {isLoading ? (
          <div className="sidebar-skeletons" role="status" aria-label="Loading conversations">
            <span className="sidebar-skeleton" /><span className="sidebar-skeleton" />
            <span className="sidebar-skeleton" /><span className="sidebar-skeleton" />
          </div>
        ) : isError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>Could not load conversations.</span>
            <button type="button" className="sidebar-retry" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <p className="sidebar-state">
            {normalizedQuery ? "No conversations match your search." : "Your conversations will appear here."}
          </p>
        ) : (
          <div className="conversation-groups">
            {conversationGroups.map(group => (
              <section key={group.label} className="conversation-group" aria-label={group.label + " conversations"}>
                <h2 className="conversation-group-label">{group.label}</h2>
                {group.items.map(conversation => {
                  const title = conversation.title || "New conversation";
                  return (
                    <Link
                      key={conversation.id}
                      href={"/app/" + conversation.id}
                      onClick={onClose}
                      className={path === "/app/" + conversation.id ? "conversation-link active" : "conversation-link"}
                      aria-current={path === "/app/" + conversation.id ? "page" : undefined}
                      title={title}
                    >
                      {highlightedTitle(title, normalizedQuery)}
                    </Link>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </nav>

      <nav className="sidebar-actions" aria-label="Workspace navigation">
        <Link href="/app/workspace" className="sidebar-action" onClick={onClose} aria-current={path.startsWith("/app/workspace") ? "page" : undefined}>
          <OzlindIcon name="i-home" size={17} /> Workspace
        </Link>
        <Link href="/app/documents" className="sidebar-action" onClick={onClose} aria-current={path.startsWith("/app/documents") ? "page" : undefined}>
          <OzlindIcon name="i-documents" size={17} /> Documents
        </Link>
        <Link href="/app/settings" className="sidebar-action" onClick={onClose} aria-current={path.startsWith("/app/settings") ? "page" : undefined}>
          <OzlindIcon name="i-settings" size={17} /> Settings
        </Link>
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar" aria-hidden="true">
          {(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="user-copy">
          <strong>{user.displayName || "Ozlind user"}</strong>
          <span title={user.email}>{user.email}</span>
          {signOutError && <span className="sidebar-signout-error" role="alert">{signOutError}</span>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={signOut}
          disabled={signingOut}
          aria-label={signingOut ? "Signing out" : "Sign out"}
          title={signingOut ? "Signing out…" : "Sign out"}
        >
          <OzlindIcon name="i-logout" size={18} />
        </button>
      </div>
    </aside>
  );
}
