"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AuthMode = "login" | "signup";

const CALLBACK_ERRORS: Record<string, string> = {
  missing_code: "The sign-in link was incomplete. Please try signing in again.",
  server_configuration: "Authentication is temporarily unavailable. Please try again later.",
  oauth_failed: "Google sign-in could not be completed. Please try again.",
};

function authConfigError() {
  return "Ozlind authentication is not configured correctly on this deployment. Please check the Supabase environment variables.";
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return authConfigError();
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "That email and password combination doesn't match. Check your details and try again.";
  if (message.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (message.includes("user already registered")) return "An account with this email already exists. Sign in instead.";
  if (message.includes("password should be at least")) return "Choose a password with at least 8 characters.";
  return error.message || authConfigError();
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const callbackError = params.get("error");
        if (callbackError && active) {
          setError(CALLBACK_ERRORS[callbackError] ?? "Sign-in could not be completed. Please try again.");
          window.history.replaceState({}, "", window.location.pathname);
        }

        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (active && data.user) window.location.replace("/app");
      } catch {
        if (active) setError(authConfigError());
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const supabase = createClient();

      if (mode === "signup") {
        if (password.length < 8) {
          setError("Choose a password with at least 8 characters.");
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: name.trim() || null } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice("Your account has been created. Check your email for a confirmation link before signing in.");
          setMode("login");
          setPassword("");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
      }

      window.location.assign("/app");
    } catch (x) {
      setError(errorMessage(x));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (x) {
      setError(errorMessage(x));
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-heading">
          <Image
            src="/ozlind-mark.svg"
            alt=""
            aria-hidden="true"
            width={52}
            height={52}
            priority
            className="brand-mark auth-brand-mark"
          />
          <p className="eyebrow">Ozlind</p>
          <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-copy">
            {isSignup
              ? "Make space for clearer thinking, better writing, and focused work."
              : "Your workspace for thinking, writing, and building."}
          </p>
        </div>

        {checkingSession ? (
          <div className="auth-checking" role="status" aria-live="polite">
            <span className="auth-spinner" aria-hidden="true" />
            <span>Checking your session…</span>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className="auth-google"
              onClick={google}
              disabled={busy}
            >
              <span className="google-g" aria-hidden="true">G</span>
              {busy ? "Connecting…" : "Continue with Google"}
            </Button>

            <div className="auth-divider"><span>or continue with email</span></div>

            <form onSubmit={submit} className="stack-4" noValidate>
              {isSignup && (
                <label className="field">
                  <span>Name <span className="auth-optional">· optional</span></span>
                  <Input
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    disabled={busy}
                    maxLength={80}
                  />
                </label>
              )}
              <label className="field">
                <span>Email address</span>
                <Input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={busy}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <Input
                  name="password"
                  type="password"
                  required
                  minLength={isSignup ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                  disabled={busy}
                />
                {isSignup && <span className="auth-field-hint">Use at least 8 characters.</span>}
              </label>

              {error && <div className="auth-feedback auth-feedback-error" role="alert">{error}</div>}
              {notice && <div className="auth-feedback auth-feedback-success" role="status">{notice}</div>}

              <Button type="submit" className="auth-submit" disabled={busy || checkingSession}>
                {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <p className="auth-switch">
              {isSignup ? "Already have an account?" : "New to Ozlind?"}{" "}
              <button
                className="text-button"
                type="button"
                onClick={() => changeMode(isSignup ? "login" : "signup")}
                disabled={busy}
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
            <p className="auth-legal">By continuing, you agree to use Ozlind responsibly.</p>
          </>
        )}
      </section>
    </main>
  );
}
