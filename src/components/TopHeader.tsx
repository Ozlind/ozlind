import React from 'react';
import { Menu, Shield } from 'lucide-react';
import OzlindLogo from './OzlindLogo';

interface TopHeaderProps {
  onToggleSidebar: () => void;
  activeTab: 'chat' | 'research' | 'capabilities' | 'settings';
  isDemo?: boolean;
  user: any;
}

export default function TopHeader({
  onToggleSidebar,
  activeTab,
  isDemo,
}: TopHeaderProps) {
  return (
    <header className="h-14 bg-[#090A0F]/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between z-30 sticky top-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <OzlindLogo className="w-6 h-6 md:hidden" glow={false} />
          <span className="text-sm font-bold text-white tracking-wide">
            {activeTab === 'chat' && 'OZLIND AI Workspace'}
            {activeTab === 'research' && 'Deep Research Engine'}
            {activeTab === 'capabilities' && 'Suite Capabilities Hub'}
            {activeTab === 'settings' && 'Settings & Custom Memory'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>OZLIND Core Online</span>
        </div>

        {isDemo && (
          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Demo Mode
          </span>
        )}

        <div className="flex items-center gap-1.5 bg-[#121422] border border-slate-800 px-2.5 py-1 rounded-lg text-xs text-slate-300">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white">Owner: Athul</span>
        </div>
      </div>
    </header>
  );
}
