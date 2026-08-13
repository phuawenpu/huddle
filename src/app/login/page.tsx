"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || "Sign-in failed.");
        return;
      }
      const requested =
        new URLSearchParams(window.location.search).get("next") || "/";
      const destination =
        requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Sign-in is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 safe-top safe-bottom safe-left safe-right">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-hud-border bg-hud-surface p-6"
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-hud-text">
            Private access
          </h1>
          <p className="text-sm text-hud-muted">
            Enter the deployment access code to continue.
          </p>
        </header>
        <label className="block space-y-2">
          <span className="text-sm text-hud-muted">Access code</span>
          <input
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            autoComplete="current-password"
            required
            maxLength={512}
            className="w-full rounded-xl border border-hud-border bg-hud-bg px-4 py-3 text-hud-text outline-none focus:border-hud-accent"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-hud-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !accessCode}
          className="w-full rounded-xl bg-hud-accent px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
