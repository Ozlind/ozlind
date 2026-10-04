"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";

function linkifyCitations(content, sources) {
  if (
    typeof content !== "string" ||
    !Array.isArray(sources) ||
    sources.length === 0
  ) {
    return content;
  }

  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part, index) => {
      if (index % 2 === 1) return part;

      return part.replace(/\[(\d{1,2})\](?!\()/g, (match, number) => {
        const url = sources[Number(number) - 1]?.url;

        if (
          typeof url !== "string" ||
          !/^https?:\/\//i.test(url)
        ) {
          return match;
        }

        return `[[${number}]](${url
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")})`;
      });
    })
    .join("");
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const codeElement = Array.isArray(children)
    ? children[0]
    : children;

  const className =
    codeElement?.props?.className || "";

  const language =
    (/language-([\w-]+)/.exec(className) || [])[1] || "";

  const raw = codeElement?.props?.children;

  const code = String(
    Array.isArray(raw)
      ? raw.join("")
      : raw ?? "",
  ).replace(/\n$/, "");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || "code"}</span>

        <button
          type="button"
          onClick={copyCode}
          aria-label="Copy code"
        >
          {copied ? (
            <Check size={13} />
          ) : (
            <Copy size={13} />
          )}

          <span>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>

      <pre>
        <code className={className}>
          {code}
        </code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({
  content,
  sources = [],
}) {
  return (
    <ReactMarkdown
      components={{
        a: ({ children, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),

        pre: ({ children }) => (
          <CodeBlock>{children}</CodeBlock>
        ),

        table: ({ children }) => (
          <div className="table-scroll">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {linkifyCitations(content, sources)}
    </ReactMarkdown>
  );
}