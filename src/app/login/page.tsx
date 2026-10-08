"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) window.location.replace("/app");
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setBusy(true);
    setError("");
    try {
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
      setError(x instanceof Error ? x.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const supabase = createClient();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
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
          className="brand-mark"
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
