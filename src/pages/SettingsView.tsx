import React, { useState, useEffect } from 'react';
import { Settings, User, SlidersVertical, Shield, Save } from 'lucide-react';

interface SettingsViewProps {
  user: any;
}

export default function SettingsView({ user }: SettingsViewProps) {
  const [displayName, setDisplayName] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [aiTone, setAiTone] = useState('executive');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user-settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setDisplayName(data.display_name || '');
          setCustomInstructions(data.custom_instructions || '');
          setAiTone(data.ai_tone || 'executive');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    try {
      await fetch('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          custom_instructions: customInstructions,
          ai_tone: aiTone
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Settings save failed:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-400" />
            <span>Settings & Memory Directives</span>
          </h1>
          <p className="text-xs text-slate-400">
            Configure custom instructions and global context injected into every OZLIND AI interaction.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Identity Section */}
          <div className="bg-[#0E101B] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>User Identity</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Athul User"
                  className="w-full bg-[#131626] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email Account
                </label>
                <input
                  type="text"
                  value={user?.email || 'athul@ozlind.ai'}
                  disabled
                  className="w-full bg-[#131626]/50 border border-slate-800/60 rounded-xl px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Persona & Memory Section */}
          <div className="bg-[#0E101B] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersVertical className="w-4 h-4 text-purple-400" />
              <span>Custom Instructions & Persona Memory</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                What would you like OZLIND AI to know about you to provide better responses?
              </label>
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                rows={4}
                placeholder="e.g. I am Athul, lead architect of OZLIND AI. Prefer concise executive answers with production-ready code examples."
                className="w-full bg-[#131626] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                AI Output Tone
              </label>
              <select
                value={aiTone}
                onChange={e => setAiTone(e.target.value)}
                className="w-full bg-[#131626] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="executive">Executive & Direct</option>
                <option value="technical">Technical & In-depth</option>
                <option value="creative">Creative & Brainstorming</option>
                <option value="concise">Ultra Concise</option>
              </select>
            </div>
          </div>

          {/* Security Architecture Box */}
          <div className="bg-[#0E101B] border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Security Architecture Status</span>
            </div>
            <p className="text-xs text-slate-400">
              OZLIND AI isolates all backend server calls server-side in Vercel serverless runtime. Zero API keys or internal database service tokens are exposed to the client or browser network inspection.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-400">
                ✓ Directives saved successfully!
              </span>
            )}
            <button
              type="submit"
              className="ml-auto py-2.5 px-6 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Directives</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
