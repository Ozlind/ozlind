"use client";

import {
  useEffect,
  useRef,
} from "react";

import type { Message } from "@/types/chat";
import { ChatMessage } from "./ChatMessage";
import { SkeletonText } from "@/components/ui/Skeleton";

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

export function MessageList({
  messages,
  loading = false,
}: MessageListProps) {
  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    messages.length,
    messages[messages.length - 1]?.content,
  ]);

  if (loading && messages.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            How can I help?
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            Ask OZLIND anything or start a
            new conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-4xl"
      aria-live="polite"
    >
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
        />
      ))}

      {loading ? (
        <div
          className="flex gap-3 px-3 py-4 sm:px-5"
          aria-label="OZLIND is responding"
        >
          <div
            aria-hidden="true"
            className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
          />

          <div className="w-32 pt-2">
            <SkeletonText lines={2} />
          </div>
        </div>
      ) : null}

      <div
        ref={bottomRef}
        aria-hidden="true"
        className="h-2"
      />
    </div>
  );
}