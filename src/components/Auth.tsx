import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMagicLinkSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) { setError('Enter your email'); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ozlind-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0b3b34,#0a2540,#1c1445)', border: '1px solid rgba(56,230,200,0.3)' }}>
            <svg viewBox="0 0 32 32" className="w-9 h-9">
              <defs>
                <linearGradient id="to" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38e6c8" />
                  <stop offset="1" stopColor="#4cc9ff" />
                </linearGradient>
              </defs>
              <text x="16" y="22" textAnchor="middle" fontWeight="900" fontSize="18" fill="url(#to)">O</text>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">OZLIND AI</h1>
          <p className="text-xs text-ozlind-muted mt-1">by Athul</p>
        </div>

        {magicLinkSent ? (
          <div className="bg-ozlind-panel border border-ozlind-border rounded-xl p-6 text-center">
            <Mail size={32} className="mx-auto mb-3 text-ozlind-cyan" />
            <h2 className="font-semibold mb-2">Check your email</h2>
            <p className="text-sm text-ozlind-muted">We sent a {isSignUp ? 'confirmation' : 'magic'} link to {email}</p>
            <button
              onClick={() => { setMagicLinkSent(false); setIsSignUp(false); }}
              className="mt-4 text-sm text-ozlind-cyan hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-ozlind-panel border border-ozlind-border rounded-xl p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-ozlind-muted">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ozlind-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-ozlind-dark border border-ozlind-border text-sm focus:border-ozlind-cyan focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-ozlind-muted">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ozlind-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required={!isSignUp}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-ozlind-dark border border-ozlind-border text-sm focus:border-ozlind-cyan focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-ozlind-cyan to-ozlind-blue text-ozlind-dark font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ozlind-dark" />
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ozlind-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-ozlind-panel text-ozlind-muted">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signInWithGoogle('OZLIND AI')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-ozlind-border text-sm hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="text-xs text-ozlind-muted hover:text-ozlind-cyan transition-colors disabled:opacity-50"
              >
                Send magic link instead
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-ozlind-cyan hover:underline"
                >
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
