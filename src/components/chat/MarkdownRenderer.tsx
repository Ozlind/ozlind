"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return plainText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const value = plainText(children).replace(/\n$/, "");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span>Code</span>
        <button type="button" className="message-action" onClick={() => void copyCode()} disabled={!value}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre><code>{children}</code></pre>
      <span className="sr-only" aria-live="polite">{copied ? "Code copied to clipboard." : ""}</span>
    </div>
  );
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        {...props}
        className={external ? "source-link-pill" : undefined}
        {...(external ? { target: "_blank", rel: "noopener noreferrer", title: "Open source in a new tab" } : {})}
      >
        {children}
      </a>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
