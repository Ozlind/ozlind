import { useState, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className || '')?.[1] || 'text';
  const text = String(children ?? '').replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 text-[11px] uppercase tracking-wide text-white/50">
        <span>{language}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed text-white/90"><code>{text}</code></pre>
    </div>
  );
}

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-ozlind text-[15px] leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: (props: ComponentPropsWithoutRef<'a'>) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline underline-offset-2 hover:text-violet-200" />
          ),
          code: (props: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
            const { className, children, inline } = props;
            if (inline) {
              return <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">{children}</code>;
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          pre: (props: ComponentPropsWithoutRef<'pre'>) => <>{props.children}</>,
          table: (props: ComponentPropsWithoutRef<'table'>) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
              <table {...props} className="w-full border-collapse text-sm" />
            </div>
          ),
          th: (props: ComponentPropsWithoutRef<'th'>) => <th {...props} className="border-b border-white/10 bg-white/5 px-3 py-2 text-left font-semibold" />,
          td: (props: ComponentPropsWithoutRef<'td'>) => <td {...props} className="border-b border-white/5 px-3 py-2 align-top" />,
          blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
            <blockquote {...props} className="my-3 border-l-2 border-violet-400/60 pl-3 text-white/70 italic" />
          ),
          ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul {...props} className="my-2 list-disc space-y-1 pl-5" />,
          ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol {...props} className="my-2 list-decimal space-y-1 pl-5" />,
          h1: (props: ComponentPropsWithoutRef<'h1'>) => <h1 {...props} className="mb-2 mt-4 text-xl font-bold" />,
          h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 {...props} className="mb-2 mt-4 text-lg font-bold" />,
          h3: (props: ComponentPropsWithoutRef<'h3'>) => <h3 {...props} className="mb-1.5 mt-3 text-base font-bold" />,
          p: (props: ComponentPropsWithoutRef<'p'>) => <p {...props} className="mb-2 last:mb-0" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
