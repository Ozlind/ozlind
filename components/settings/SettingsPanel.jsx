"use client";

import { X } from "lucide-react";

export default function SettingsPanel({ open, settings, onUpdate, onClose }) {
  if (!open) return null;

  return (
    <div className="oz-v3-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="oz-v3-settings" role="dialog" aria-modal="true" aria-label="Settings">
        <header>
          <div>
            <span className="oz-v3-kicker">OZLIND</span>
            <h2>Workspace settings</h2>
          </div>
          <button type="button" className="oz-v3-icon-button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <label className="oz-v3-setting-row">
          <span><strong>Live research</strong><small>Use live web sources for fresh questions.</small></span>
          <input type="checkbox" checked={settings.research} onChange={(e) => onUpdate({ research: e.target.checked })} />
        </label>

        <label className="oz-v3-setting-row">
          <span><strong>Memory context</strong><small>Use relevant saved document context.</small></span>
          <input type="checkbox" checked={settings.memory} onChange={(e) => onUpdate({ memory: e.target.checked })} />
        </label>

        <label className="oz-v3-field">
          <span>Response style</span>
          <select value={settings.responseStyle} onChange={(e) => onUpdate({ responseStyle: e.target.value })}>
            <option value="balanced">Balanced</option>
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="direct">Direct</option>
          </select>
        </label>

        <label className="oz-v3-field">
          <span>Response length</span>
          <select value={settings.responseLength} onChange={(e) => onUpdate({ responseLength: e.target.value })}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>

        <label className="oz-v3-field">
          <span>Custom instructions</span>
          <textarea
            rows={5}
            value={settings.customInstructions}
            onChange={(e) => onUpdate({ customInstructions: e.target.value.slice(0, 5000) })}
            placeholder="Tell OZLIND how you prefer responses."
          />
        </label>
      </section>
    </div>
  );
}
