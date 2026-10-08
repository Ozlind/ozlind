"use client";

import Link from "next/link";
import { usePreferences, type Preferences } from "@/hooks/usePreferences";

const models: Array<[Preferences["default_model"], string]> = [
  ["groq:llama-3.3-70b-versatile", "Llama 3.3 70B"],
  ["groq:deepseek-r1-distill-llama-70b", "DeepThink"],
  ["google:gemini-2.0-flash", "Gemini Flash"],
];

export default function SettingsPage() {
  const { preferences, update, loading, saving } = usePreferences();

  if (loading) return <main className="settings-page"><p>Loading settings…</p></main>;

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Ozlind</p>
          <h1>Settings</h1>
          <p>Control how Ozlind looks, feels, and behaves.</p>
        </div>
        <Link href="/app" className="text-button">Back to chat</Link>
      </header>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-grid">
          <label className="setting-row"><span>Theme</span><select value={preferences.theme} onChange={e => update({ theme: e.target.value as Preferences["theme"] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="setting-row"><span>Accent</span><input type="color" value={preferences.accent} onChange={e => update({ accent: e.target.value })}/></label>
          <label className="setting-row"><span>Density</span><select value={preferences.density} onChange={e => update({ density: e.target.value as Preferences["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
          <label className="setting-row"><span>Layout</span><select value={preferences.layout} onChange={e => update({ layout: e.target.value as Preferences["layout"] })}><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Chat</h2>
        <div className="settings-grid">
          <label className="setting-row"><span>Default model</span><select value={preferences.default_model} onChange={e => update({ default_model: e.target.value as Preferences["default_model"] })}>{models.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="setting-row"><span>Language</span><select value={preferences.language} onChange={e => update({ language: e.target.value as Preferences["language"] })}><option value="en">English</option><option value="ml">മലയാളം</option></select></label>
          <label className="setting-row"><span>Enter to send</span><input type="checkbox" checked={preferences.enter_to_send} onChange={e => update({ enter_to_send: e.target.checked })}/></label>
          <label className="setting-row"><span>Auto-scroll</span><input type="checkbox" checked={preferences.auto_scroll} onChange={e => update({ auto_scroll: e.target.checked })}/></label>
          <label className="setting-row"><span>Show reasoning</span><input type="checkbox" checked={preferences.show_reasoning} onChange={e => update({ show_reasoning: e.target.checked })}/></label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Developer</h2>
        <p className="settings-muted">Code theme and artifact controls are ready for the next production layer.</p>
      </section>
      {saving && <div className="settings-saving">Saving…</div>}
    </main>
  );
}
