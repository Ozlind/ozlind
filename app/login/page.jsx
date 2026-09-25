"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const supabase = createClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          window.location.replace("/");
          return;
        }
      } catch (error) {
        console.error(
          "Session check failed:",
          error
        );
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleGoogleLogin() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const redirectTo =
        `${window.location.origin}/auth/callback`;

      const { error: authError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

      if (authError) {
        throw authError;
      }
    } catch (error) {
      console.error(
        "Google login failed:",
        error
      );

      setError(
        error?.message ||
          "Google login could not be started."
      );

      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="login-page">
        <div className="login-card">
          <Loader2
            className="login-spinner"
            size={24}
          />
          <p>Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Sparkles size={22} />
          </div>

          <div>
            <strong>OZLIND</strong>
            <span>AI PLATFORM</span>
          </div>
        </div>

        <div className="login-heading">
          <h1>Welcome to OZLIND</h1>

          <p>
            Sign in to continue to your AI workspace.
          </p>
        </div>

        <button
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <Loader2
              size={19}
              className="login-spinner"
            />
          ) : (
            <GoogleIcon />
          )}

          <span>
            {loading
              ? "Connecting..."
              : "Continue with Google"}
          </span>
        </button>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <div className="login-security">
          <ShieldCheck size={15} />

          <span>
            Secure authentication powered by
            Supabase.
          </span>
        </div>

        <p className="login-footer">
          By continuing, you agree to use OZLIND
          responsibly.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.72-.06-1.41-.18-2.08H12v3.94h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.21 2.91-7.25Z"
      />
      <path
        fill="#34A853"
        d="M12 21.7c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.78A5.85 5.85 0 0 1 6.24 12c0-.62.11-1.22.3-1.78V7.69H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.31l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.19c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.25 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C6.31 7.91 8.46 6.19 12 6.19Z"
      />
    </svg>
  );
}