"use client";

import { Copy, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const MarkdownRenderer = dynamic(() => import("@/components/MarkdownRenderer"));

export default function MessageList({
  messages,
  streaming,
  onCopy,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);
  if (!messages.length) {
    return (
      <section className="oz-v3-empty" aria-label="Start a conversation">
        <div className="oz-v3-empty-mark">O</div>
        <h1>What can OZLIND help you solve?</h1>
        <p>Ask, write, research, analyse, plan or build.</p>
      </section>
    );
  }

  return (
    <div className="oz-v3-message-list" role="log" aria-live="polite">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const lastAssistant =
          !isUser && index === messages.length - 1;

        return (
          <article
            className={"oz-v3-message " + (isUser ? "is-user" : "is-assistant")}
            key={message.id || index}
          >
            <div className="oz-v3-message-avatar" aria-hidden="true">
              {isUser ? (
                <UserRound size={16} />
              ) : (
                <svg className="oz-v3-message-mark" viewBox="0 0 96 96" aria-hidden="true">
                  <use href="/ozlind-icons.svg#ozl-mark" />
                </svg>
              )}
            </div>

            <div className="oz-v3-message-body">
              {message.attachment ? (
                <div className="oz-v3-attachment">
                  <strong>{message.attachment.name}</strong>
                  {message.attachment.size ? (
                    <span>{Math.ceil(message.attachment.size / 1024)} KB</span>
                  ) : null}
                </div>
              ) : null}

              <div className="oz-v3-message-content">
                {message.content ? (
                  isUser ? (
                    <p>{message.content}</p>
                  ) : (
                    <MarkdownRenderer>{message.content}</MarkdownRenderer>
                  )
                ) : (
                  <div className="oz-v3-thinking" aria-label="OZLIND is generating">
                    <span /><span /><span />
                  </div>
                )}
              </div>

              {message.sources?.length ? (
                <div className="oz-v3-sources">
                  {message.sources.slice(0, 4).map((source, sourceIndex) => (
                    <a
                      key={source.url || sourceIndex}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sourceIndex + 1}. {source.domain || source.title}
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="oz-v3-message-actions">
                <button type="button" onClick={() => onCopy(message.content)} aria-label="Copy message">
                  <Copy size={14} />
                </button>

              </div>
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
