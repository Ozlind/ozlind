"use client";

import {
  MessageSquare,
  Plus,
  X,
} from "lucide-react";

import type {
  ConversationSummary,
} from "@/types/chat";

import {
  Button,
} from "@/components/ui/Button";

interface SidebarProps {
  open: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}

export function Sidebar({
  open,
  conversations,
  activeId,
  onClose,
  onNewChat,
  onSelect,
}: SidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/50 lg:hidden"
      />

      <aside
        className="fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[var(--border)] bg-[var(--surface-1)]"
        aria-label="Chat history"
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-3">
          <span className="text-sm font-semibold text-[var(--text)]">
            Chats
          </span>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] lg:hidden"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="p-3">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onNewChat}
          >
            <Plus
              size={16}
              aria-hidden="true"
            />
            New chat
          </Button>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
          aria-label="Conversations"
        >
          {conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-[var(--text-faint)]">
              No conversations yet.
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map(
                (conversation) => {
                  const active =
                    conversation.id ===
                    activeId;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() =>
                        onSelect(
                          conversation.id,
                        )
                      }
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                        "transition-colors",
                        active
                          ? "bg-[var(--surface-2)] text-[var(--text)]"
                          : "text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                      ].join(" ")}
                    >
                      <MessageSquare
                        size={15}
                        className="shrink-0"
                        aria-hidden="true"
                      />

                      <span className="min-w-0 flex-1 truncate text-sm">
                        {conversation.title ||
                          "New chat"}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}