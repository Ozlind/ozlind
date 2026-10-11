"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban, LogOut } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

type SidebarUser = { id: string; email: string; displayName: string };

export function Sidebar({
  user,
  mobileOpen,
  onClose,
}: {
  user: SidebarUser;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
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
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  const conversations = data.filter((item) =>
    (item.title || "New conversation").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <aside
      id="ozlind-sidebar"
      className={"sidebar " + (mobileOpen ? "sidebar-open" : "")}
      aria-label="Main navigation"
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <Image src="/ozlind-mark.svg" alt="" width={32} height={32} priority />
          <span>Ozlind</span>
          <button
            className="icon-button mobile-close"
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <OzlindIcon name="i-close" size={20} />
          </button>
        </div>
        <Button
          onClick={() => {
            router.push("/app");
            onClose();
          }}
        >
          <OzlindIcon name="i-new-conversation" size={18} />
          New chat
        </Button>
        <label className="search-box">
          <OzlindIcon name="i-search" size={16} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </label>
      </div>

      <nav className="conversation-list" aria-label="Recent conversations">
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={"/app/" + conversation.id}
            onClick={onClose}
            className={
              path === "/app/" + conversation.id
                ? "conversation-link active"
                : "conversation-link"
            }
            aria-current={path === "/app/" + conversation.id ? "page" : undefined}
            title={conversation.title || "New conversation"}
          >
            {conversation.title || "New conversation"}
          </Link>
        ))}
        {conversations.length === 0 && q.trim() && (
          <p className="sidebar-empty">No matching conversations</p>
        )}
      </nav>

      <nav className="sidebar-actions" aria-label="Workspace">
        <Link href="/app/workspace" className="sidebar-action" onClick={onClose}>
          <FolderKanban size={17} />
          Workspace
        </Link>
        <Link href="/app/documents" className="sidebar-action" onClick={onClose}>
          <OzlindIcon name="i-documents" size={17} />
          Documents
        </Link>
        <Link href="/app/settings" className="sidebar-action" onClick={onClose}>
          <OzlindIcon name="i-settings" size={17} />
          Settings
        </Link>
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar" aria-hidden="true">
          {(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="user-copy">
          <strong>{user.displayName || "Ozlind user"}</strong>
          <span title={user.email}>{user.email}</span>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
