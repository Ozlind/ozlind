"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, LoaderCircle, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

type Preset = { id: string; name: string; system_prompt: string; model: string };
type Artifact = { id: string; title: string; kind: "text" | "code" | "markdown" | "json"; content: string; version: number };
type WorkspaceTab = "presets" | "artifacts";

const DEFAULT_MODEL = "groq:llama-3.3-70b-versatile";

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code;
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Your session has expired. Sign in again to manage your workspace.",
      PRESETS_UNAVAILABLE: "Presets could not be loaded.",
      ARTIFACTS_UNAVAILABLE: "Saved artifacts could not be loaded.",
      INVALID_INPUT: "Check the details and try again.",
      PRESET_SAVE_FAILED: "The preset could not be saved.",
      PRESET_DELETE_FAILED: "The preset could not be deleted.",
      ARTIFACT_SAVE_FAILED: "The artifact could not be saved.",
      ARTIFACT_DELETE_FAILED: "The artifact could not be deleted.",
    };
    throw new Error(messages[code] ?? "Something went wrong. Please try again.");
  }
  return payload;
}

export default function WorkspacePage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactContent, setArtifactContent] = useState("");
  const [artifactKind, setArtifactKind] = useState<Artifact["kind"]>("markdown");
  const [tab, setTab] = useState<WorkspaceTab>("presets");
  const [search, setSearch] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPreset, setSavingPreset] = useState(false);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [presetResponse, artifactResponse] = await Promise.all([
        fetch("/api/presets", { cache: "no-store" }),
        fetch("/api/artifacts", { cache: "no-store" }),
      ]);
      const [presetPayload, artifactPayload] = await Promise.all([
        readPayload(presetResponse),
        readPayload(artifactResponse),
      ]);
      setPresets(Array.isArray(presetPayload?.presets) ? presetPayload.presets : []);
      setArtifacts(Array.isArray(artifactPayload?.artifacts) ? artifactPayload.artifacts : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workspace data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addPreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !prompt.trim() || savingPreset) return;
    setSavingPreset(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), system_prompt: prompt.trim(), model: DEFAULT_MODEL }),
      });
      await readPayload(response);
      setName("");
      setPrompt("");
      setNotice("Preset saved. It’s ready for your next conversation.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The preset could not be saved.");
    } finally {
      setSavingPreset(false);
    }
  }

  async function addArtifact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!artifactTitle.trim() || !artifactContent.trim() || savingArtifact) return;
    setSavingArtifact(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: artifactTitle.trim(),
          content: artifactContent,
          kind: artifactKind,
          version: 1,
        }),
      });
      await readPayload(response);
      setArtifactTitle("");
      setArtifactContent("");
      setNotice("Saved to your workspace.");
      setTab("artifacts");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The artifact could not be saved.");
    } finally {
      setSavingArtifact(false);
    }
  }

  async function removeItem(kind: WorkspaceTab, id: string, title: string) {
    if (deletingId) return;
    if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
    setDeletingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/${kind === "presets" ? "presets" : "artifacts"}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await readPayload(response);
      if (kind === "presets") setPresets(items => items.filter(item => item.id !== id));
      else {
        setArtifacts(items => items.filter(item => item.id !== id));
        setSelectedArtifact(current => current?.id === id ? null : current);
      }
      setNotice(`${kind === "presets" ? "Preset" : "Artifact"} deleted.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPresets = presets.filter(item =>
    `${item.name} ${item.system_prompt}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredArtifacts = artifacts.filter(item =>
    `${item.title} ${item.kind} ${item.content}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="settings-page workspace-page">
      <header className="settings-header workspace-header">
        <div>
          <p className="eyebrow">Your space, your work</p>
          <h1>Workspace</h1>
          <p>Keep your best instructions close and your useful work in one place.</p>
        </div>
        <Link href="/app" className="text-button workspace-back"><ArrowLeft size={15} aria-hidden="true" /> Back to chat</Link>
      </header>

      {(error || notice) && (
        <div className={error ? "workspace-feedback workspace-feedback-error" : "workspace-feedback"} role={error ? "alert" : "status"}>
          <span>{error || notice}</span>
          {error && <button type="button" className="workspace-retry" onClick={() => void load()}><RefreshCw size={14} /> Retry</button>}
          <button type="button" className="workspace-dismiss" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></button>
        </div>
      )}

      <div className="workspace-tabs" role="tablist" aria-label="Workspace content">
        <button type="button" role="tab" aria-selected={tab === "presets"} className={tab === "presets" ? "workspace-tab active" : "workspace-tab"} onClick={() => { setTab("presets"); setSearch(""); }}>
          Presets <span>{presets.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "artifacts"} className={tab === "artifacts" ? "workspace-tab active" : "workspace-tab"} onClick={() => { setTab("artifacts"); setSearch(""); }}>
          Saved artifacts <span>{artifacts.length}</span>
        </button>
      </div>

      <div className="workspace-layout">
        <section className="workspace-primary" aria-label={tab === "presets" ? "Saved presets" : "Saved artifacts"}>
          <div className="workspace-list-heading">
            <div>
              <h2>{tab === "presets" ? "Your presets" : "Your saved work"}</h2>
              <p>{tab === "presets" ? "Reusable instructions for the way you work." : "Notes, snippets and outputs you want to keep."}</p>
            </div>
            <label className="workspace-search">
              <Search size={16} aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find something…" aria-label="Search workspace" />
            </label>
          </div>

          {loading ? (
            <div className="workspace-skeleton-list" aria-label="Loading workspace" aria-busy="true">
              {[0, 1, 2].map(item => <div className="workspace-skeleton" key={item}><span /><div><i /><i /></div></div>)}
              <p className="settings-muted"><LoaderCircle size={14} className="workspace-spin" /> Loading your workspace…</p>
            </div>
          ) : tab === "presets" ? (
            filteredPresets.length ? (
              <div className="workspace-items">
                {filteredPresets.map(item => (
                  <article className="workspace-item" key={item.id}>
                    <div className="workspace-item-icon"><FileText size={18} aria-hidden="true" /></div>
                    <div className="workspace-item-copy">
                      <h3>{item.name}</h3>
                      <p>{item.system_prompt}</p>
                      <span className="workspace-item-meta">{item.model.replace("groq:", "").replace("google:", "")}</span>
                    </div>
                    <button type="button" className="icon-button workspace-delete" disabled={deletingId === item.id} onClick={() => void removeItem("presets", item.id, item.name)} aria-label={`Delete ${item.name}`} title="Delete preset">
                      {deletingId === item.id ? <LoaderCircle size={16} className="workspace-spin" /> : <Trash2 size={16} />}
                    </button>
                  </article>
                ))}
              </div>
            ) : <div className="workspace-empty"><div className="workspace-empty-mark"><FileText size={20} /></div><h3>{search ? "No matching presets" : "A better starting point"}</h3><p>{search ? "Try another search term." : "Save instructions you use often, so you can get to the good part faster next time."}</p>{!search && <button className="ui-button ui-button-secondary" onClick={() => document.getElementById("preset-name")?.focus()}><Plus size={16} /> Create your first preset</button>}</div>
          ) : (
            filteredArtifacts.length ? (
              <div className="workspace-items">
                {filteredArtifacts.map(item => (
                  <article className={selectedArtifact?.id === item.id ? "workspace-item selected" : "workspace-item"} key={item.id}>
                    <button type="button" className="workspace-artifact-open" onClick={() => setSelectedArtifact(item)} aria-label={`Open ${item.title}`}>
                      <div className="workspace-item-icon"><FileText size={18} aria-hidden="true" /></div>
                      <div className="workspace-item-copy"><h3>{item.title}</h3><p>{item.content.slice(0, 150) || "No preview available"}{item.content.length > 150 ? "…" : ""}</p><span className="workspace-item-meta">{item.kind.toUpperCase()} · Version {item.version}</span></div>
                    </button>
                    <button type="button" className="icon-button workspace-delete" disabled={deletingId === item.id} onClick={() => void removeItem("artifacts", item.id, item.title)} aria-label={`Delete ${item.title}`} title="Delete artifact">
                      {deletingId === item.id ? <LoaderCircle size={16} className="workspace-spin" /> : <Trash2 size={16} />}
                    </button>
                  </article>
                ))}
              </div>
            ) : <div className="workspace-empty"><div className="workspace-empty-mark"><FileText size={20} /></div><h3>{search ? "No matching artifacts" : "Keep the useful bits"}</h3><p>{search ? "Try another search term." : "Save a note, code snippet or answer here. Your saved work stays tied to your account."}</p>{!search && <button className="ui-button ui-button-secondary" onClick={() => document.getElementById("artifact-title")?.focus()}><Plus size={16} /> Save an artifact</button>}</div>
          )}
        </section>

        <aside className="workspace-forms">
          {tab === "presets" ? (
            <section className="workspace-form-card">
              <div className="workspace-form-heading"><span className="workspace-step">01</span><div><h2>Create a preset</h2><p>Give Ozlind a useful starting point.</p></div></div>
              <form className="stack-4" onSubmit={addPreset}>
                <label className="field" htmlFor="preset-name">Name<input id="preset-name" className="ui-input" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Product reviewer" maxLength={80} required /></label>
                <label className="field" htmlFor="preset-prompt">Instructions<textarea id="preset-prompt" className="ui-input workspace-textarea" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="How should Ozlind approach this kind of task?" maxLength={12000} required /></label>
                <p className="workspace-helper">{prompt.length.toLocaleString()} / 12,000 characters</p>
                <button className="ui-button ui-button-primary workspace-submit" type="submit" disabled={savingPreset || !name.trim() || !prompt.trim()}>{savingPreset ? <><LoaderCircle size={16} className="workspace-spin" /> Saving preset…</> : <><Plus size={16} /> Save preset</>}</button>
              </form>
            </section>
          ) : (
            <section className="workspace-form-card">
              <div className="workspace-form-heading"><span className="workspace-step">02</span><div><h2>Save an artifact</h2><p>Keep a useful result for later.</p></div></div>
              <form className="stack-4" onSubmit={addArtifact}>
                <label className="field" htmlFor="artifact-title">Title<input id="artifact-title" className="ui-input" value={artifactTitle} onChange={event => setArtifactTitle(event.target.value)} placeholder="Give it a clear name" maxLength={160} required /></label>
                <label className="field" htmlFor="artifact-kind">Format<select id="artifact-kind" className="ui-input" value={artifactKind} onChange={event => setArtifactKind(event.target.value as Artifact["kind"])}><option value="markdown">Markdown</option><option value="text">Plain text</option><option value="code">Code</option><option value="json">JSON</option></select></label>
                <label className="field" htmlFor="artifact-content">Content<textarea id="artifact-content" className="ui-input workspace-textarea workspace-artifact-textarea" value={artifactContent} onChange={event => setArtifactContent(event.target.value)} placeholder="Paste or write the content you want to keep…" maxLength={100000} required /></label>
                <p className="workspace-helper">{artifactContent.length.toLocaleString()} / 100,000 characters</p>
                <button className="ui-button ui-button-primary workspace-submit" type="submit" disabled={savingArtifact || !artifactTitle.trim() || !artifactContent.trim()}>{savingArtifact ? <><LoaderCircle size={16} className="workspace-spin" /> Saving…</> : <><Plus size={16} /> Save artifact</>}</button>
              </form>
            </section>
          )}
          {selectedArtifact && tab === "artifacts" && (
            <section className="workspace-form-card workspace-preview">
              <div className="workspace-form-heading"><div><h2>{selectedArtifact.title}</h2><p>{selectedArtifact.kind.toUpperCase()} · Version {selectedArtifact.version}</p></div><button type="button" className="icon-button" aria-label="Close artifact preview" onClick={() => setSelectedArtifact(null)}><X size={17} /></button></div>
              <pre>{selectedArtifact.content}</pre>
            </section>
          )}
          <p className="workspace-privacy">Your presets and artifacts are private to your account.</p>
        </aside>
      </div>
    </main>
  );
}
