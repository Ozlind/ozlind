import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import { Menu, LogOut, Sparkles } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-ozlind-dark text-ozlind-text flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 h-full transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} w-[280px] flex-shrink-0 bg-ozlind-panel border-r border-ozlind-border flex flex-col`}>
        <div className="p-4 flex items-center gap-3 border-b border-ozlind-border">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0b3b34,#0a2540,#1c1445)' }}>
            <svg viewBox="0 0 32 32" className="w-6 h-6">
              <defs>
                <linearGradient id="t" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38e6c8" />
                  <stop offset="1" stopColor="#4cc9ff" />
                </linearGradient>
              </defs>
              <text x="16" y="22" textAnchor="middle" fontWeight="900" fontSize="18" fill="url(#t)">O</text>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">OZLIND AI</h1>
            <p className="text-[10px] text-ozlind-muted">by Athul</p>
          </div>
        </div>

        <Sidebar onNavigate={() => setSidebarOpen(false)} />

        <div className="p-4 border-t border-ozlind-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-ozlind-accent flex items-center justify-center text-xs font-bold text-ozlind-cyan">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 flex items-center gap-3 px-4 border-b border-ozlind-border bg-ozlind-dark/80 backdrop-blur z-20 sticky top-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Sparkles size={16} className="text-ozlind-cyan" />
          <span className="text-sm font-medium">Workspace</span>
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
