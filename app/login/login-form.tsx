"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("Check your email and password, then try again.");
      setWorking(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm text-ember-muted">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-ember-muted/30 bg-white/[0.04] px-4 py-3 text-ember-paper outline-none focus:border-ember-amber"
        />
      </label>
      <label className="block">
        <span className="text-sm text-ember-muted">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-ember-muted/30 bg-white/[0.04] px-4 py-3 text-ember-paper outline-none focus:border-ember-amber"
        />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={working}
        className="w-full cursor-pointer rounded-full bg-ember-amber px-5 py-3 text-sm font-semibold text-ember-ink transition-transform duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {working ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
