"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { resetAnalyticsIdentity } from "@/lib/analytics";
import { useEffect, useState } from "react";

type SidebarProps = {
  user: { id: string; email: string; displayName: string };
  mobileOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ user, mobileOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const path = usePathname();
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [conversationActionError, setConversationActionError] = useState("");

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
    queryKey: ["conversations", user.id, showArchived],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .select("id,title,updated_at,pinned")
        .eq("user_id", user.id)
        .eq("archived", showArchived)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
  });

  async function renameConversation(event: React.FormEvent<HTMLFormElement>, conversationId: string) {
    event.preventDefault();
    const title = renameTitle.trim().slice(0, 160);
    if (!title) {
      setConversationActionError("Give this conversation a name before saving.");
      return;
    }
    if (actionBusyId) return;
    setActionBusyId(conversationId);
    setConversationActionError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .update({ title })
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Conversation was not found.");
      setRenamingId(null);
      setRenameTitle("");
      await refetch();
    } catch {
      setConversationActionError("Could not rename this conversation. Please try again.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function togglePinned(conversationId: string, pinned: boolean) {
    if (actionBusyId) return;
    setActionBusyId(conversationId);
    setConversationActionError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .update({ pinned })
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Conversation was not found.");
      await refetch();
    } catch {
      setConversationActionError("Could not update this conversation's pin. Please try again.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function archiveConversation(conversationId: string, archived: boolean) {
    if (actionBusyId) return;
    setActionBusyId(conversationId);
    setConversationActionError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .update({ archived })
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Conversation was not found.");
      if (archived && path === "/app/" + conversationId) router.replace("/app");
      await refetch();
    } catch {
      setConversationActionError(archived
        ? "Could not archive this conversation. Please try again."
        : "Could not restore this conversation. Please try again.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      resetAnalyticsIdentity();
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

        <Button onClick={() => { router.push("/app"); onClose(); }}>
          <OzlindIcon name="i-new-conversation" size={18} />
          New chat
        </Button>

        <label className="search-box">
          <OzlindIcon name="i-search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search your chats"
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

      <div className="conversation-view-switch" role="group" aria-label="Conversation history filter">
        <button type="button" className={!showArchived ? "active" : ""} aria-pressed={!showArchived} onClick={() => { setShowArchived(false); setRenamingId(null); }}>Recent</button>
        <button type="button" className={showArchived ? "active" : ""} aria-pressed={showArchived} onClick={() => { setShowArchived(true); setRenamingId(null); }}>Archived</button>
      </div>

      <nav className="conversation-list" aria-label={showArchived ? "Archived conversations" : "Conversation history"}>
        {conversationActionError && <p className="sidebar-action-error" role="alert">{conversationActionError}</p>}
        {isLoading ? (
          <p className="sidebar-state" role="status">Loading conversations…</p>
        ) : isError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>Could not load conversations.</span>
            <button type="button" className="sidebar-retry" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <p className="sidebar-state">
            {normalizedQuery ? "No conversations match your search." : showArchived ? "No archived conversations yet." : "Your conversations will appear here."}
          </p>
        ) : (
          filteredConversations.map((conversation) => (
            <div className="conversation-row" key={conversation.id}>
              {renamingId === conversation.id ? (
                <form className="conversation-rename-form" onSubmit={(event) => void renameConversation(event, conversation.id)}>
                  <input
                    value={renameTitle}
                    onChange={(event) => setRenameTitle(event.target.value)}
                    maxLength={160}
                    aria-label="New conversation name"
                    autoFocus
                  />
                  <button type="submit" disabled={actionBusyId === conversation.id || !renameTitle.trim()}>Save</button>
                  <button type="button" onClick={() => { setRenamingId(null); setRenameTitle(""); }} disabled={actionBusyId === conversation.id}>Cancel</button>
                </form>
              ) : (
                <>
                  <Link
                    href={"/app/" + conversation.id}
                    onClick={onClose}
                    className={path === "/app/" + conversation.id ? "conversation-link active" : "conversation-link"}
                    aria-current={path === "/app/" + conversation.id ? "page" : undefined}
                    title={conversation.title || "New conversation"}
                  >
                    <span className="conversation-link-title">{conversation.pinned && <OzlindIcon name="i-bookmark" size={12} aria-hidden="true" />}<span>{conversation.title || "New conversation"}</span></span>
                  </Link>
                  <details className="conversation-menu">
                    <summary aria-label={"Actions for " + (conversation.title || "New conversation")} title="Conversation actions">···</summary>
                    <div className="conversation-menu-panel">
                      <button type="button" disabled={actionBusyId === conversation.id} onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        void togglePinned(conversation.id, !conversation.pinned);
                      }}><OzlindIcon name="i-bookmark" size={14} /> {conversation.pinned ? "Unpin" : "Pin to top"}</button>
                      <button type="button" onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        setRenamingId(conversation.id);
                        setRenameTitle(conversation.title || "");
                        setConversationActionError("");
                      }}><OzlindIcon name="i-edit" size={14} /> Rename</button>
                      <button type="button" disabled={actionBusyId === conversation.id} onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        void archiveConversation(conversation.id, !showArchived);
                      }}><OzlindIcon name={showArchived ? "i-refresh" : "i-bookmark"} size={14} /> {showArchived ? "Restore" : "Archive"}</button>
                    </div>
                  </details>
                </>
              )}
            </div>
          ))
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
