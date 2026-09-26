"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function OzlindMark() {
  return (
    <div className="login-brand-mark" aria-hidden="true">
      <span className="login-brand-letter">O</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const supabase = await createClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session) {
          router.replace("/");
          return;
        }

        setChecking(false);
      } catch (err) {
        console.error("Supabase session check failed:", err);

        if (mounted) {
          setChecking(false);
          setError("Unable to initialize authentication.");
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleGoogleLogin() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = await createClient();

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error: authError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

      if (authError) {
        console.error(
          "Google sign-in error:",
          authError.message
        );

        setError(
          authError.message ||
            "Google sign-in could not be started."
        );

        setLoading(false);
      }
    } catch (err) {
      console.error("Google sign-in failed:", err);

      setError(
        "Unable to start Google sign-in. Please try again."
      );

      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="login-page" aria-busy="true">
        <section className="login-card login-loading-card">
          <OzlindMark />

          <div className="login-loading-copy">
            <span className="login-loading-spinner" />
            <p>Checking your session…</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-background-glow login-background-glow-one" />
      <div className="login-background-glow login-background-glow-two" />

      <section
        className="login-card"
        aria-labelledby="login-title"
      >
        <div className="login-brand">
          <OzlindMark />

          <div className="login-brand-name">
            <span>Ozlind</span>
            <strong>AI</strong>
          </div>

          <p>Your intelligent workspace</p>
        </div>

        <div className="login-heading">
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue to your AI workspace.</p>
        </div>

        {error ? (
          <div
            className="login-error"
            role="alert"
            aria-live="polite"
          >
            <span className="login-error-icon">!</span>
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="button"
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={loading}
          aria-busy={loading}
        >
          <span className="google-login-icon">
            <GoogleIcon />
          </span>

          <span className="google-login-label">
            {loading
              ? "Connecting to Google…"
              : "Continue with Google"}
          </span>

          {!loading ? (
            <span
              className="google-login-arrow"
              aria-hidden="true"
            >
              →
            </span>
          ) : (
            <span
              className="login-button-spinner"
              aria-hidden="true"
            />
          )}
        </button>

        <div className="login-divider" aria-hidden="true">
          <span />
          <em>SECURE SIGN IN</em>
          <span />
        </div>

        <div className="login-security">
          <div className="login-security-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 3L19 6V11.5C19 16.15 16.08 19.95 12 21C7.92 19.95 5 16.15 5 11.5V6L12 3Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <strong>Secure authentication</strong>
            <span>Your Google account stays protected.</span>
          </div>
        </div>

        <p className="login-footer">
          By continuing, you agree to use OZLIND responsibly.
        </p>

        <div className="login-legal">
          <span>Terms</span>
          <i>·</i>
          <span>Privacy</span>
        </div>
      </section>
    </main>
  );
}