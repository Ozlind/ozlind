import {
  ExternalLink,
} from "lucide-react";

import type { Source } from "@/types/chat";

interface SourceChipsProps {
  sources: Source[];
}

export function SourceChips({
  sources,
}: SourceChipsProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Sources"
      className="border-t border-[var(--border)] px-4 py-3"
    >
      <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto pb-1">
        {sources.map((source, index) => (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            title={source.title}
          >
            <span className="max-w-40 truncate">
              {source.domain ||
                source.title}
            </span>

            <ExternalLink
              size={12}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
}