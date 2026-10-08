"use client";

import Link from "next/link";
import { usePreferences, type Preferences } from "@/hooks/usePreferences";
import { t } from "@/lib/i18n";

const models: Array<[Preferences["default_model"], string]> = [
  ["groq:llama-3.3-70b-versatile", "Llama 3.3 70B"],
  ["groq:deepseek-r1-distill-llama-70b", "DeepThink"],
  ["google:gemini-2.0-flash", "Gemini Flash"],
];

export default function SettingsPage() {
  const { preferences, update, loading, saving } = usePreferences();
  const tr = (key: Parameters<typeof t>[1]) => t(preferences.language, key);

  if (loading) return <main className="settings-page"><p>{tr("loading")}</p></main>;

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Ozlind</p>
          <h1>{tr("settings")}</h1>
          <p>Control how Ozlind looks, feels, and behaves.</p>
        </div>
        <Link href="/app" className="text-button">{tr("back")}</Link>
      </header>

      <section className="settings-section">
        <h2>{tr("appearance")}</h2>
        <div className="settings-grid">
          <label className="setting-row"><span>{tr("theme")}</span><select value={preferences.theme} onChange={e => update({ theme: e.target.value as Preferences["theme"] })}><option value="system">{tr("system")}</option><option value="light">{tr("light")}</option><option value="dark">{tr("dark")}</option></select></label>
          <label className="setting-row"><span>{tr("accent")}</span><input type="color" value={preferences.accent} onChange={e => update({ accent: e.target.value })}/></label>
          <label className="setting-row"><span>{tr("density")}</span><select value={preferences.density} onChange={e => update({ density: e.target.value as Preferences["density"] })}><option value="compact">{tr("compact")}</option><option value="comfortable">{tr("comfortable")}</option><option value="spacious">{tr("spacious")}</option></select></label>
          <label className="setting-row"><span>{tr("layout")}</span><select value={preferences.layout} onChange={e => update({ layout: e.target.value as Preferences["layout"] })}><option value="standard">{tr("standard")}</option><option value="wide">{tr("wide")}</option></select></label>
        </div>
      </section>

      <section className="settings-section">
        <h2>{tr("chat")}</h2>
        <div className="settings-grid">
          <label className="setting-row"><span>{tr("defaultModel")}</span><select value={preferences.default_model} onChange={e => update({ default_model: e.target.value as Preferences["default_model"] })}>{models.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="setting-row"><span>{tr("language")}</span><select value={preferences.language} onChange={e => update({ language: e.target.value as Preferences["language"] })}><option value="en">English</option><option value="ml">മലയാളം</option></select></label>
          <label className="setting-row"><span>{tr("enterToSend")}</span><input type="checkbox" checked={preferences.enter_to_send} onChange={e => update({ enter_to_send: e.target.checked })}/></label>
          <label className="setting-row"><span>{tr("autoScroll")}</span><input type="checkbox" checked={preferences.auto_scroll} onChange={e => update({ auto_scroll: e.target.checked })}/></label>
          <label className="setting-row"><span>{tr("showReasoning")}</span><input type="checkbox" checked={preferences.show_reasoning} onChange={e => update({ show_reasoning: e.target.checked })}/></label><label className="setting-row"><span>Live web research</span><input type="checkbox" checked={preferences.research_enabled} onChange={e => update({ research_enabled: e.target.checked })}/></label>
        </div>
      </section>

      <section className="settings-section">
        <h2>{tr("developer")}</h2>
        <p className="settings-muted">Code theme and artifact controls are ready for the next production layer.</p>
      </section>
      {saving && <div className="settings-saving">{tr("saving")}</div>}
    </main>
  );
}
