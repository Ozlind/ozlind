"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function authConfigError() {
  return "Ozlind authentication is not configured correctly on this deployment. Please check the Supabase environment variables.";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const supabase = createClient();
        const { data, error: sessionError } = await supabase.auth.getUser();

        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        if (data.user) window.location.replace("/app");
      } catch (x) {
        if (active) {
          setError(x instanceof Error ? x.message : authConfigError());
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || null } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      window.location.assign("/app");
    } catch (x) {
      setError(x instanceof Error ? x.message : authConfigError());
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (x) {
      setError(x instanceof Error ? x.message : authConfigError());
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Image
          src="/ozlind-mark.svg"
          alt="Ozlind"
          width={64}
          height={64}
          priority
          className="brand-mark auth-brand-mark"
        />
        <div>
          <p className="eyebrow">Ozlind</p>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-copy">A calm workspace for thinking, writing, and building.</p>
        </div>
        <form onSubmit={submit} className="stack-4">
          {mode === "signup" && (
            <label className="field">
              <span>Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <Button disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <Button type="button" variant="secondary" onClick={google} disabled={busy}>Continue with Google</Button>
        <button className="text-button" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create an account" : "I already have an account"}
        </button>
      </section>
    </main>
  );
}
