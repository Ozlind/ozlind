"use client";

import {
  Bot,
  Check,
  Copy,
  User,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

import type { Message } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({
  message,
}: ChatMessageProps) {
  const [copied, setCopied] =
    useState(false);

  const isUser =
    message.role === "user";

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(
        message.content,
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1500,
      );
    } catch {
      setCopied(false);
    }
  };

  return (
    <article
      className={cn(
        "flex w-full gap-3 px-3 py-4 sm:px-5",
        isUser
          ? "justify-end"
          : "justify-start",
      )}
      aria-label={
        isUser
          ? "Your message"
          : "OZLIND response"
      }
    >
      {!isUser ? (
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
        >
          <Bot
            size={17}
            className="text-[var(--accent)]"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "min-w-0",
          isUser
            ? "max-w-[88%] sm:max-w-[75%]"
            : "max-w-[94%] flex-1 sm:max-w-[80%]",
        )}
      >
        <div
          className={cn(
            "rounded-2xl",
            isUser
              ? "rounded-tr-md bg-[var(--surface-2)] px-4 py-3"
              : "px-0 py-1",
          )}
        >
          {isUser ? (
            <div className="flex items-start gap-2">
              <User
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--text-dim)]"
              />

              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
                {message.content}
              </p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none break-words text-sm leading-6 text-[var(--text)]">
              <ReactMarkdown
                components={{
                  a: ({
                    children,
                    href,
                  }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] underline underline-offset-2"
                    >
                      {children}
                    </a>
                  ),

                  code: ({
                    children,
                    className,
                  }) => (
                    <code
                      className={cn(
                        "rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs",
                        className,
                      )}
                    >
                      {children}
                    </code>
                  ),

                  pre: ({
                    children,
                  }) => (
                    <pre className="my-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 text-xs">
                      {children}
                    </pre>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser &&
        message.content ? (
          <button
            type="button"
            onClick={copyMessage}
            aria-label={
              copied
                ? "Message copied"
                : "Copy message"
            }
            className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            {copied ? (
              <Check
                size={13}
                aria-hidden="true"
              />
            ) : (
              <Copy
                size={13}
                aria-hidden="true"
              />
            )}

            {copied
              ? "Copied"
              : "Copy"}
          </button>
        ) : null}
      </div>
    </article>
  );
}