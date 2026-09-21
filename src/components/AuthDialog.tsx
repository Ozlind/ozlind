import { useState } from 'react';
import { X, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

export default function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const res = await sendMagicLink(email);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Could not send the magic link.');
    else setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121c] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">Sign in to OZLIND</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="text-emerald-400" size={36} />
            <p className="text-sm text-white/70">Check your inbox at <span className="font-medium text-white">{email}</span> for a secure sign-in link.</p>
            <button onClick={onClose} className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-white/60">Your chats sync securely across devices. No password needed - we'll email you a magic link.</p>
            <label htmlFor="auth-email" className="sr-only">Email</label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              <Mail size={16} className="text-white/40" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? 'Sending\u2026' : 'Send magic link'}
            </button>
            <p className="text-center text-[11px] text-white/30">You can also keep using OZLIND as a guest — sign in anytime to sync your history.</p>
          </form>
        )}
      </div>
    </div>
  );
}
