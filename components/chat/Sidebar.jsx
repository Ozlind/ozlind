"use client";

import { MessageSquarePlus, Search, Settings2, Trash2, X } from "lucide-react";

export default function Sidebar({
  open,
  history,
  activeChatId,
  query,
  onQuery,
  onNewChat,
  onOpen,
  onDelete,
  onSettings,
  onClose,
}) {
  const filtered = history.filter((item) =>
    String(item.title || "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      {open ? <button className="oz-v3-backdrop" aria-label="Close menu" onClick={onClose} /> : null}
      <aside className={"oz-v3-sidebar " + (open ? "is-open" : "")}>
        <div className="oz-v3-sidebar-top">
          <button className="oz-v3-brand" onClick={onNewChat} aria-label="New OZLIND chat">
            <span className="oz-v3-brand-mark">O</span>
            <span>OZLIND</span>
          </button>
          <button type="button" className="oz-v3-icon-button mobile-only" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <button type="button" className="oz-v3-new-chat" onClick={onNewChat}>
          <MessageSquarePlus size={18} />
          New chat
        </button>

        <label className="oz-v3-search">
          <Search size={16} />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search chats" />
        </label>

        <div className="oz-v3-history">
          <div className="oz-v3-section-label">Recent</div>
          {filtered.length ? filtered.map((item) => (
            <div className={"oz-v3-history-row " + (item.id === activeChatId ? "is-active" : "")} key={item.id}>
              <button type="button" onClick={() => onOpen(item.id)}>{item.title || "New conversation"}</button>
              <button type="button" className="oz-v3-delete" onClick={() => onDelete(item.id)} aria-label="Delete conversation">
                <Trash2 size={14} />
              </button>
            </div>
          )) : <div className="oz-v3-history-empty">No conversations</div>}
        </div>

        <div className="oz-v3-sidebar-bottom">
          <button type="button" onClick={onSettings}><Settings2 size={17} /> Settings</button>
        </div>
      </aside>
    </>
  );
}
