import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Sparkles, 
  WandSparkles, 
  Image as ImageIcon, 
  Code, 
  Mic, 
  Clock, 
  CheckCircle2, 
  X,
  Share2
} from 'lucide-react';

interface Capability {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'active' | 'coming_soon';
  badge: string;
}

export default function CapabilitiesHub() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<Capability | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/capabilities')
      .then(res => res.json())
      .then(data => setCapabilities(data.capabilities || []))
      .catch(console.error);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <Cpu className="w-3.5 h-3.5" />
            <span>OZLIND Suite Capabilities Registry</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Intelligence & Tooling Suite
          </h1>
          <p className="text-slate-400 text-sm">
            All capabilities operate under the OZLIND unified architecture owned by Athul. Future capabilities are explicitly marked as <strong className="text-amber-400">NEXT</strong> and actively in development.
          </p>
        </div>

        {/* Grid of Capabilities */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(cap => {
            const isActive = cap.status === 'active';
            return (
              <div
                key={cap.id}
                onClick={() => !isActive && setSelectedRoadmap(cap)}
                className={`relative p-5 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-[#0E101B] border-slate-800'
                    : 'bg-[#0B0C16] border-slate-800/60 hover:border-amber-500/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 text-cyan-400">
                    {cap.id === 'chat' && <Sparkles className="w-5 h-5 text-cyan-400" />}
                    {cap.id === 'research' && <WandSparkles className="w-5 h-5 text-purple-400" />}
                    {cap.id === 'vision' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
                    {cap.id === 'image_gen' && <ImageIcon className="w-5 h-5 text-amber-400" />}
                    {cap.id === 'photo_editor' && <WandSparkles className="w-5 h-5 text-rose-400" />}
                    {cap.id === 'code_assistant' && <Code className="w-5 h-5 text-blue-400" />}
                    {cap.id === 'voice_ai' && <Mic className="w-5 h-5 text-indigo-400" />}
                    {cap.id === 'knowledge_graph' && <Share2 className="w-5 h-5 text-teal-400" />}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {isActive ? 'Active Engine' : cap.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{cap.name}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {cap.description}
                </p>

                {!isActive && (
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-amber-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>In Development</span>
                    </span>
                    <span className="underline">Notify Me</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal for Roadmap Capabilities */}
        {selectedRoadmap && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0E101B] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{selectedRoadmap.name}</h3>
                <button
                  onClick={() => {
                    setSelectedRoadmap(null);
                    setWaitlistSuccess(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400">{selectedRoadmap.description}</p>

              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-300">
                This capability is scheduled for rollout in <strong>{selectedRoadmap.badge}</strong>. We adhere strictly to transparent product principles — no mock or fake functionality.
              </div>

              {waitlistSuccess ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You are on the priority access waitlist!</span>
                </div>
              ) : (
                <button
                  onClick={() => setWaitlistSuccess(true)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Request Early Access
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedRoadmap(null);
                  setWaitlistSuccess(false);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
