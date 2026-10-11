"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban, LogOut, Search, X } from "lucide-react";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
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
            <Image src="/ozlind-mark.svg" alt="" width={32} height={32} />
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
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear conversation search"
            >
              <X size={15} />
            </button>
          )}
        </label>
      </div>

      <nav className="conversation-list" aria-label="Conversation history">
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
            {normalizedQuery ? "No conversations match your search." : "Your conversations will appear here."}
          </p>
        ) : (
          filteredConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={"/app/" + conversation.id}
              onClick={onClose}
              className={path === "/app/" + conversation.id ? "conversation-link active" : "conversation-link"}
              aria-current={path === "/app/" + conversation.id ? "page" : undefined}
              title={conversation.title || "New conversation"}
            >
              {conversation.title || "New conversation"}
            </Link>
          ))
        )}
      </nav>

      <nav className="sidebar-actions" aria-label="Workspace navigation">
        <Link href="/app/workspace" className="sidebar-action" onClick={onClose} aria-current={path.startsWith("/app/workspace") ? "page" : undefined}>
          <FolderKanban size={17} aria-hidden="true" /> Workspace
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
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
