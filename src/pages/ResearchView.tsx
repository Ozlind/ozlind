import React, { useState } from 'react';
import { Compass, Search, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';

interface ResearchViewProps {
  onStartResearch?: (topic: string) => void;
}

export default function ResearchView({}: ResearchViewProps) {
  const [topic, setTopic] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleExecuteResearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim() || isSearching) return;

    setIsSearching(true);
    setResult(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: topic }],
          mode: 'research',
          webSearch: true
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Research error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>Autonomous Web Research Pipeline</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            OZLIND Deep Web Research
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Execute real-time internet searches, source verification, multi-source synthesis, and executive reports without generic link noise.
          </p>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleExecuteResearch} className="relative max-w-2xl mx-auto">
          <div className="relative bg-[#10121F] border border-slate-800 rounded-2xl p-2 shadow-2xl focus-within:border-purple-500/60 transition-all flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400 ml-3 shrink-0" />
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter a research topic, market trend, or technical thesis..."
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500 py-2"
            />
            <button
              type="submit"
              disabled={!topic.trim() || isSearching}
              className="py-2.5 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isSearching ? 'Synthesizing...' : 'Start Research'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Loading Pipeline State */}
        {isSearching && (
          <div className="bg-[#0E101A] border border-slate-800 rounded-2xl p-6 text-center space-y-4 max-w-2xl mx-auto animate-pulse">
            <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-400 rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-bold text-white">Scanning Live Knowledge Repositories...</p>
              <p className="text-xs text-slate-500 mt-1">
                Verifying academic & enterprise sources and synthesizing intelligence report
              </p>
            </div>
          </div>
        )}

        {/* Intelligence Briefing Output */}
        {result && (
          <div className="bg-[#0E101B] border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-bold text-white">Verified Intelligence Brief</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">Status: Verified</span>
            </div>

            <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed">
              <p className="whitespace-pre-wrap">{result.content}</p>
            </div>

            {/* Cited Source Repositories */}
            {result.sources && result.sources.length > 0 && (
              <div className="border-t border-slate-800 pt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Cited Source Repositories
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.sources.map((src: any, idx: number) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#131626] border border-slate-800 hover:border-purple-500/40 rounded-xl transition-all block group"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-purple-300 truncate">
                        <span className="truncate">{src.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 ml-1" />
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {src.snippet}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
