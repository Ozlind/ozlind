import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import OzlindLogo from '../components/OzlindLogo';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle } from '../lib/googleAuth';
import supabase from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadingAction(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate('/workspace');
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDemoLaunch = () => {
    loginAsDemo();
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen bg-[#07080E] text-white flex items-center justify-center p-4">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#0D0F1A] border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <OzlindLogo className="w-12 h-12 mx-auto" glow={true} />
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">OZLIND AI</h1>
            <p className="text-xs text-slate-400 mt-1">
              Unified AI Workspace • Owned & Created by Athul
            </p>
          </div>
        </div>

        {/* Instant Owner Demo Mode Banner */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 rounded-2xl p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-400">
            <Sparkles className="w-4 h-4" />
            <span>Instant Workspace Preview</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Experience OZLIND AI instantly with the pre-authenticated Owner Demo mode.
          </p>
          <button
            onClick={handleDemoLaunch}
            className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Launch Owner Demo Mode
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#0D0F1A] px-3 text-[10px] text-slate-500 uppercase font-semibold">
            Or Account Sign In
          </span>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-[#131524] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#131524] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingAction}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {loadingAction ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={() => signInWithGoogle('OZLIND AI')}
          className="w-full py-2.5 bg-[#121422] hover:bg-[#181a2e] border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-1.9.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        {/* Toggle sign in / sign up */}
        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
