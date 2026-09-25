"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    setLoading(true);
    setError("");

    try {
      const supabase = await createClient();

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
      <main className="login-page">
        <section className="login-card">
          <div className="login-logo">O</div>

          <p className="login-muted">
            Checking your session…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">O</div>

        <h1>Welcome to OZLIND</h1>

        <p className="login-muted">
          Sign in to continue to your AI workspace.
        </p>

        {error ? (
          <div
            className="login-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.35 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.15Z"
            />

            <path
              fill="#34A853"
              d="M12 21.67c2.63 0 4.84-.87 6.45-2.29l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.67Z"
            />

            <path
              fill="#FBBC05"
              d="M6.54 13.82a5.86 5.86 0 0 1 0-3.64V7.65H3.3a9.76 9.76 0 0 0 0 8.7l3.24-2.53Z"
            />

            <path
              fill="#EA4335"
              d="M12 6.15c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.83 3.29 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.7 5.32l3.24 2.53C7.31 7.87 9.46 6.15 12 6.15Z"
            />
          </svg>

          {loading
            ? "Connecting to Google…"
            : "Continue with Google"}
        </button>

        <p className="login-footer">
          By continuing, you agree to use OZLIND responsibly.
        </p>
      </section>
    </main>
  );
}