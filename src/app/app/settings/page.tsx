"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setAnalyticsOptOut } from "@/lib/analytics";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { usePreferences, type Preferences, defaultPreferences } from "@/hooks/usePreferences";
import { t } from "@/lib/i18n";

const models: Array<[Preferences["default_model"], string, string]> = [
  ["groq:llama-3.3-70b-versatile", "Llama 3.3 70B", "Fast, general-purpose chat"],
  ["groq:deepseek-r1-distill-llama-70b", "DeepThink", "Reasoning-focused responses"],
  ["google:gemini-2.0-flash", "Gemini Flash", "Fast multimodal model"],
];

export default function SettingsPage() {
  const { preferences, update, loading, saving, saveError, clearSaveError } = usePreferences();
  const analyticsGloballyPaused = process.env.NEXT_PUBLIC_OZLIND_ANALYTICS_ENABLED !== "true";
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [analyticsSettingsLoaded, setAnalyticsSettingsLoaded] = useState(false);
  const [browserDoNotTrack, setBrowserDoNotTrack] = useState(false);
  const [healthRefresh, setHealthRefresh] = useState(0);
  const [serviceStatus, setServiceStatus] = useState<null | { ready: boolean; checks: { supabase: boolean; supabaseConfigured: boolean; supabaseReachable: boolean; groq: boolean; google: boolean; vision: boolean; researchConfigured: boolean; aiGatewayConfigured: boolean; gatewayFastModelConfigured: boolean; gatewayProModelConfigured: boolean; gatewayAutoModelConfigured: boolean; gatewayVisionModelConfigured: boolean }; timestamp: string }>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    const doNotTrack = navigator.doNotTrack === "1";
    setBrowserDoNotTrack(doNotTrack);
    try {
      setAnalyticsEnabled(!doNotTrack && localStorage.getItem("ozlind_analytics_opt_out") !== "1");
    } catch {
      setAnalyticsEnabled(!doNotTrack);
    }
    setAnalyticsSettingsLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    setHealthError(false);
    fetch("/api/ready", { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async response => {
        if (!response.ok && response.status !== 503) throw new Error("Health check unavailable");
        return response.json();
      })
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        const value = data as typeof serviceStatus;
        if (!value || typeof value.ready !== "boolean" || !value.checks) throw new Error("Invalid health response");
        setServiceStatus(value);
      })
      .catch(() => { if (!cancelled) { setServiceStatus(null); setHealthError(true); } })
      .finally(() => { if (!cancelled) setHealthLoading(false); });
    return () => { cancelled = true; };
  }, [healthRefresh]);

  function updateAnalyticsConsent(enabled: boolean) {
    setAnalyticsEnabled(enabled);
    setAnalyticsOptOut(!enabled);
  }
  const tr = (key: Parameters<typeof t>[1]) => t(preferences.language, key);

  function resetPreferences() {
    if (!window.confirm("Reset your appearance and chat preferences to their defaults?")) return;
    void update({ ...defaultPreferences });
  }

  if (loading) {
    return (
      <main className="settings-page settings-page-polished" aria-busy="true">
        <div className="settings-loading" role="status"><OzlindIcon name="sym-processing" size={20} className="settings-spinner" /><span>Loading your preferences…</span></div>
      </main>
    );
  }

  return (
    <main className="settings-page settings-page-polished">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Ozlind · Personalization</p>
          <h1>{tr("settings")}</h1>
          <p>Make Ozlind work the way you prefer. Changes are saved to your account.</p>
        </div>
        <Link href="/app" className="text-button settings-back"><OzlindIcon name="i-back" size={15} aria-hidden="true" /> {tr("back")}</Link>
      </header>

      {saveError && (
        <div className="settings-feedback settings-feedback-error" role="alert">
          <span>{saveError}</span>
          <button type="button" onClick={clearSaveError} className="settings-feedback-dismiss" aria-label="Dismiss error"><OzlindIcon name="i-close" size={16} /></button>
        </div>
      )}
      {saving && <div className="settings-save-status" role="status"><OzlindIcon name="sym-processing" size={15} className="settings-spinner" /> Saving your changes…</div>}

      <section className="settings-section settings-section-polished" aria-labelledby="settings-appearance">
        <div className="settings-section-intro">
          <h2 id="settings-appearance">{tr("appearance")}</h2>
          <p>Adjust the visual tone and spacing of the app.</p>
        </div>
        <div className="settings-grid settings-grid-polished">
          <label className="setting-row setting-row-polished" htmlFor="pref-theme">
            <span><strong>{tr("theme")}</strong><small>Choose light, dark, or follow your device.</small></span>
            <select id="pref-theme" value={preferences.theme} onChange={e => void update({ theme: e.target.value as Preferences["theme"] })}>
              <option value="system">{tr("system")}</option><option value="light">{tr("light")}</option><option value="dark">{tr("dark")}</option>
            </select>
          </label>
          <label className="setting-row setting-row-polished" htmlFor="pref-accent">
            <span><strong>{tr("accent")}</strong><small>Pick the highlight color used for key actions.</small></span>
            <span className="settings-color-control"><span className="settings-color-swatch" style={{ backgroundColor: preferences.accent }} aria-hidden="true" /><input id="pref-accent" type="color" value={preferences.accent} onChange={e => void update({ accent: e.target.value })} aria-label="Accent color" /></span>
          </label>
          <label className="setting-row setting-row-polished" htmlFor="pref-density">
            <span><strong>{tr("density")}</strong><small>Control the vertical space between messages.</small></span>
            <select id="pref-density" value={preferences.density} onChange={e => void update({ density: e.target.value as Preferences["density"] })}>
              <option value="compact">{tr("compact")}</option><option value="comfortable">{tr("comfortable")}</option><option value="spacious">{tr("spacious")}</option>
            </select>
          </label>
          <label className="setting-row setting-row-polished" htmlFor="pref-layout">
            <span><strong>{tr("layout")}</strong><small>Use the standard reading width or a wider canvas.</small></span>
            <select id="pref-layout" value={preferences.layout} onChange={e => void update({ layout: e.target.value as Preferences["layout"] })}>
              <option value="standard">{tr("standard")}</option><option value="wide">{tr("wide")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-section settings-section-polished" aria-labelledby="settings-chat">
        <div className="settings-section-intro">
          <h2 id="settings-chat">{tr("chat")}</h2>
          <p>Set your default model, language, and conversation behavior.</p>
        </div>
        <div className="settings-grid settings-grid-polished">
          <label className="setting-row setting-row-polished" htmlFor="pref-model">
            <span><strong>{tr("defaultModel")}</strong><small>Used as the starting model for new chats.</small></span>
            <select id="pref-model" value={preferences.default_model} onChange={e => void update({ default_model: e.target.value as Preferences["default_model"] })}>
              {models.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="setting-row setting-row-polished" htmlFor="pref-language">
            <span><strong>{tr("language")}</strong><small>Choose the interface language.</small></span>
            <select id="pref-language" value={preferences.language} onChange={e => void update({ language: e.target.value as Preferences["language"] })}>
              <option value="en">English</option><option value="ml">മലയാളം</option>
            </select>
          </label>
          <label className="setting-row setting-row-polished setting-toggle-row" htmlFor="pref-enter">
            <span><strong>{tr("enterToSend")}</strong><small>Press Enter to send; use Shift + Enter for a new line.</small></span>
            <input id="pref-enter" type="checkbox" checked={preferences.enter_to_send} onChange={e => void update({ enter_to_send: e.target.checked })} />
          </label>
          <label className="setting-row setting-row-polished setting-toggle-row" htmlFor="pref-scroll">
            <span><strong>{tr("autoScroll")}</strong><small>Keep the latest response in view as it streams.</small></span>
            <input id="pref-scroll" type="checkbox" checked={preferences.auto_scroll} onChange={e => void update({ auto_scroll: e.target.checked })} />
          </label>
          <label className="setting-row setting-row-polished setting-toggle-row" htmlFor="pref-reasoning">
            <span><strong>{tr("showReasoning")}</strong><small>Show reasoning details when the selected model provides them.</small></span>
            <input id="pref-reasoning" type="checkbox" checked={preferences.show_reasoning} onChange={e => void update({ show_reasoning: e.target.checked })} />
          </label>
          <label className="setting-row setting-row-polished setting-toggle-row" htmlFor="pref-research">
            <span><strong>Live web research</strong><small>Allow supported chat flows to use live web research.</small></span>
            <input id="pref-research" type="checkbox" checked={preferences.research_enabled} onChange={e => void update({ research_enabled: e.target.checked })} />
          </label>
        </div>
      </section>


      <section className="settings-section settings-section-polished" aria-labelledby="settings-analytics">
        <div className="settings-section-intro">
          <h2 id="settings-analytics">Privacy & analytics</h2>
          <p>Choose whether Ozlind can send limited product diagnostics to help improve reliability and speed.</p>
        </div>
        <div className="settings-grid settings-grid-polished">
          <label className="setting-row setting-row-polished setting-toggle-row" htmlFor="pref-analytics">
            <span>
              <strong>Share product diagnostics</strong>
              <small>
                Records page visits, browser error types, performance timings, and chat request outcomes.
                Prompts, replies, uploaded content, emails, and error stacks are not sent. Signed-in events
                use your internal account ID rather than your email.
                {browserDoNotTrack ? " Your browser's Do Not Track setting disables analytics." : ""}
                {analyticsGloballyPaused ? " Analytics collection is temporarily paused globally; this preference will not enable collection until it is resumed." : ""}
              </small>
            </span>
            <input
              id="pref-analytics"
              type="checkbox"
              checked={analyticsEnabled && !browserDoNotTrack && !analyticsGloballyPaused}
              disabled={!analyticsSettingsLoaded || browserDoNotTrack || analyticsGloballyPaused}
              onChange={e => updateAnalyticsConsent(e.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="settings-section settings-section-polished" aria-labelledby="settings-health">
        <div className="settings-section-intro">
          <h2 id="settings-health">Service status</h2>
          <p>Live configuration checks for the services that power your workspace. Provider credentials are never shown.</p>
        </div>
        <div className="settings-grid settings-grid-polished">
          {healthLoading ? <p role="status">Checking service status…</p> : healthError || !serviceStatus ? <p role="status">Status is temporarily unavailable. Your chats are not changed by this check.</p> : <>
            <div className="setting-row setting-row-polished"><span><strong>Supabase</strong><small>{serviceStatus.checks.supabaseReachable ? "Connected" : serviceStatus.checks.supabaseConfigured ? "Configured, connection unavailable" : "Needs configuration"}</small></span><span aria-label={serviceStatus.checks.supabaseReachable ? "Connected" : "Not connected"}>{serviceStatus.checks.supabaseReachable ? "●" : "○"}</span></div>
            <div className="setting-row setting-row-polished"><span><strong>AI text generation</strong><small>{serviceStatus.checks.groq || serviceStatus.checks.google || (serviceStatus.checks.aiGatewayConfigured && (serviceStatus.checks.gatewayFastModelConfigured || serviceStatus.checks.gatewayProModelConfigured || serviceStatus.checks.gatewayAutoModelConfigured)) ? "Provider configured; live generation not tested here" : "No text provider configured"}</small></span><span>{serviceStatus.checks.groq || serviceStatus.checks.google || serviceStatus.checks.aiGatewayConfigured ? "●" : "○"}</span></div>
            <div className="setting-row setting-row-polished"><span><strong>Image understanding</strong><small>{serviceStatus.checks.vision || (serviceStatus.checks.aiGatewayConfigured && serviceStatus.checks.gatewayVisionModelConfigured) ? "Vision provider configured; live inference not tested here" : "Needs provider configuration"}</small></span><span>{serviceStatus.checks.vision || (serviceStatus.checks.aiGatewayConfigured && serviceStatus.checks.gatewayVisionModelConfigured) ? "●" : "○"}</span></div>
            <div className="setting-row setting-row-polished"><span><strong>Multi-provider AI Gateway</strong><small>{serviceStatus.checks.aiGatewayConfigured ? "Gateway key is configured; model routing depends on the model IDs below" : "Optional — configure AI_GATEWAY_API_KEY server-side to add gateway-routed OpenAI, Anthropic, Google and other supported models"}</small></span><span>{serviceStatus.checks.aiGatewayConfigured ? "●" : "○"}</span></div>
            <div className="setting-row setting-row-polished"><span><strong>Live web research</strong><small>{serviceStatus.checks.researchConfigured ? "Search provider configured; live search not tested here" : "Search provider not configured"}</small></span><span>{serviceStatus.checks.researchConfigured ? "●" : "○"}</span></div>
          </>}
        </div>
        <button type="button" className="ui-button ui-button-secondary settings-reset-button" onClick={() => setHealthRefresh(value => value + 1)} disabled={healthLoading}>Refresh status</button>
        {serviceStatus && !healthLoading && <p className="settings-persisted">Last checked {new Date(serviceStatus.timestamp).toLocaleTimeString()}</p>}
      </section>

      <section className="settings-section settings-section-polished settings-reset-section">
        <div className="settings-section-intro">
          <h2>Reset preferences</h2>
          <p>Restore the original appearance and chat defaults. This does not delete conversations or saved work.</p>
        </div>
        <button type="button" className="ui-button ui-button-secondary settings-reset-button" onClick={resetPreferences} disabled={saving}>
          <OzlindIcon name="i-refresh" size={15} /> Reset to defaults
        </button>
      </section>

      {!saving && !saveError && <p className="settings-persisted" role="status"><OzlindIcon name="i-check" size={14} /> Your preferences are up to date.</p>}
    </main>
  );
}
