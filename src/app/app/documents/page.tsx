"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { OzlindIcon } from "@/components/ui/OzlindIcon";

type DocumentRow = {
  id: string;
  name: string;
  mime: string;
  size_bytes: number | null;
  chunk_count: number;
  status: string;
  created_at: string;
};
type Result = { id: string; name: string; content: string; similarity: number };

const MAX_FILE_BYTES = 2_000_000;
const MAX_CONTENT_CHARS = 120_000;
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".json"];

function formatBytes(bytes: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return "Size unavailable";
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function friendlyError(code?: string, message?: string) {
  if (code === "AUTH_REQUIRED") return "Your session may have expired. Sign in again and retry.";
  if (code === "DOCUMENT_LIMIT_REACHED") return "Your library already has 20 documents. Delete one before adding another.";
  if (code === "INVALID_DOCUMENT") return "This file could not be accepted. Check the file type and content, then retry.";
  return message || "Something went wrong. Please try again.";
}

export default function DocumentsPage() {
  const input = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyError(body?.error?.code, body?.error?.message));
      setDocuments(Array.isArray(body?.documents) ? body.documents : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your documents.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function upload(file: File) {
    setNotice("");
    setError("");
    setResults(null);
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Choose a TXT, Markdown, CSV or JSON file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Maximum file size is 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      if (!content.trim()) throw new Error("This file is empty.");
      if (content.length > MAX_CONTENT_CHARS) {
        throw new Error("This file contains too much text. The current limit is 120,000 characters.");
      }
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mime: file.type || "text/plain", sizeBytes: file.size, content }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyError(body?.error?.code, body?.error?.message));
      setNotice(`“${file.name}” was added to your library.`);
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(document: DocumentRow) {
    if (!window.confirm(`Delete “${document.name}” from your library?`)) return;
    setError("");
    setNotice("");
    setDeletingId(document.id);
    try {
      const response = await fetch("/api/documents?id=" + encodeURIComponent(document.id), { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyError(body?.error?.code, body?.error?.message));
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setResults((current) => current?.filter((item) => item.id !== document.id) ?? null);
      setNotice(`“${document.name}” was deleted.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this document.");
    } finally {
      setDeletingId(null);
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/documents?q=" + encodeURIComponent(term), { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyError(body?.error?.code, body?.error?.message || "Document search failed."));
      setResults(Array.isArray(body?.results) ? body.results : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document search failed.");
    } finally {
      setBusy(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    setError("");
    setNotice("");
  }

  return (
    <main className="settings-page documents-page">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Private workspace</p>
          <h1>Documents</h1>
          <p>Keep a searchable knowledge library for your conversations.</p>
        </div>
        <Link href="/app" className="text-button">Back to chat</Link>
      </header>

      {error && <div className="documents-feedback documents-feedback-error" role="alert">
        <span>{error}</span>
        <button type="button" className="documents-feedback-action" onClick={() => { setError(""); void load(); }}>Try again</button>
      </div>}
      {notice && <div className="documents-feedback" role="status">
        <span>{notice}</span>
        <button type="button" className="documents-dismiss" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button>
      </div>}

      <section className="settings-section">
        <div className="documents-section-heading">
          <div><h2>Your library</h2><p>Up to 20 text-based files, each up to 2 MB.</p></div>
          <button type="button" className="documents-refresh" onClick={() => void load()} disabled={loading || busy} aria-label="Refresh document library">
            {loading ? <Loader2 size={16} className="documents-spinner" /> : <RefreshCw size={16} />}
            <span>Refresh</span>
          </button>
        </div>
        <div className="documents-upload-panel">
          <div className="documents-upload-icon"><Upload size={20} /></div>
          <div className="documents-upload-copy">
            <strong>Add a document</strong>
            <p>TXT, Markdown, CSV or JSON · up to 2 MB and 120,000 characters</p>
          </div>
          <button type="button" className="ui-button ui-button-primary documents-upload-button" onClick={() => input.current?.click()} disabled={busy || documents.length >= 20}>
            {busy ? <Loader2 size={16} className="documents-spinner" /> : <Upload size={16} />}
            {busy ? "Processing…" : "Choose file"}
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json"
            onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }}
          />
        </div>
        <p className="documents-count">{documents.length} of 20 documents used</p>
        {loading ? (
          <div className="documents-state" role="status"><Loader2 size={20} className="documents-spinner" /><span>Loading your library…</span></div>
        ) : documents.length ? (
          <div className="documents-list">
            {documents.map((document) => (
              <article className="documents-item" key={document.id}>
                <div className="documents-file-icon"><FileText size={19} /></div>
                <div className="documents-item-copy">
                  <strong title={document.name}>{document.name}</strong>
                  <p>{formatBytes(document.size_bytes)} <span aria-hidden="true">·</span> {document.chunk_count} chunks <span aria-hidden="true">·</span> {document.status}</p>
                </div>
                <button type="button" className="icon-button documents-delete" onClick={() => void remove(document)} disabled={busy || deletingId !== null} aria-label={`Delete ${document.name}`}>
                  {deletingId === document.id ? <Loader2 size={17} className="documents-spinner" /> : <Trash2 size={17} />}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="documents-state documents-empty">
            <FileText size={24} />
            <strong>No documents yet</strong>
            <p>Add a text-based file to search its contents in your private library.</p>
          </div>
        )}
      </section>

      <section className="settings-section documents-search-section">
        <div className="documents-section-heading">
          <div><h2>Search your knowledge</h2><p>Find relevant passages from documents you have added.</p></div>
        </div>
        <form className="search-box documents-search-form" onSubmit={search}>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about your documents…" aria-label="Search document contents" />
          {query && <button type="button" className="documents-clear" onClick={clearSearch} aria-label="Clear search"><X size={16} /></button>}
          <button className="text-button documents-search-button" type="submit" disabled={!query.trim() || busy}>{busy ? "Searching…" : "Search"}</button>
        </form>
        {results !== null && (
          <div className="documents-results" aria-live="polite">
            <div className="documents-results-heading">
              <h3>Relevant passages</h3>
              <span>{results.length} {results.length === 1 ? "result" : "results"}</span>
            </div>
            {results.length ? results.map((result) => (
              <article className="documents-result" key={result.id}>
                <div className="documents-result-meta"><FileText size={15} /><strong>{result.name}</strong><span>Match {(result.similarity * 100).toFixed(0)}%</span></div>
                <p>{result.content}</p>
              </article>
            )) : <p className="settings-muted documents-no-results">No relevant passages found. Try a different phrase or add more documents.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
