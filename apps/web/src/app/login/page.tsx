"use client";

import { Wordmark } from "@/components/brand/Wordmark";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

type AuthStatus = {
  ok: boolean;
  reachable: boolean;
  email: boolean;
  google: boolean;
  github: boolean;
  mailpit: string | null;
  message: string | null;
};

function safeNextParam(raw: string | null): string {
  if (!raw) return "/settings";
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/settings";
  }
  return next;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextParam(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? decodeURIComponent(searchParams.get("error")!)
      : null,
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: AuthStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            ok: false,
            reachable: false,
            email: false,
            google: false,
            github: false,
            mailpit: "http://127.0.0.1:54324",
            message: "status probe failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const redirectTo = () => {
    const origin = window.location.origin;
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const magicLink = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!status?.reachable) {
        setError("Auth backend offline. Run: supabase start --ignore-health-check");
        return;
      }
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo(),
          shouldCreateUser: true,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setMessage(
        status.mailpit
          ? `Magic link queued. Open local mail → ${status.mailpit}`
          : "Check your email for the magic link.",
      );
    });
  };

  const passwordAuth = (kind: "signin" | "signup") => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!status?.reachable) {
        setError("Auth backend offline. Run: supabase start --ignore-health-check");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      const supabase = createClient();
      if (kind === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (err) {
          setError(err.message);
          return;
        }
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signErr) {
          setMessage(
            "Account created. If confirmations are on, check mail then sign in.",
          );
          return;
        }
        window.location.href = next;
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      window.location.href = next;
    });
  };

  const oauth = (provider: "google" | "github") => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!status?.reachable) {
        setError("Auth backend offline. Run: supabase start --ignore-health-check");
        return;
      }
      if (provider === "google" && !status.google) {
        setError("Google provider not enabled on Auth. Check supabase/.env + restart.");
        return;
      }
      if (provider === "github" && !status.github) {
        setError(
          "GitHub not configured. Add GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET to supabase/.env (callback http://127.0.0.1:54321/auth/v1/callback), then restart supabase.",
        );
        return;
      }
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo(),
          skipBrowserRedirect: false,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data?.url) window.location.href = data.url;
    });
  };

  const providerBits =
    status == null
      ? "…"
      : [
          status.reachable ? "up" : "down",
          `e=${status.email ? 1 : 0}`,
          `g=${status.google ? 1 : 0}`,
          `gh=${status.github ? 1 : 0}`,
        ].join(" ");

  return (
    <section className="mx-auto w-full max-w-md border border-rule bg-panel">
      <header className="border-b border-rule px-4 py-4">
        <h1 className="font-display text-3xl tracking-[-0.04em] text-ink">
          Sign in
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Needed to submit a match.{" "}
          <Link href="/cinema/demo" className="text-breaker hover:underline">
            Watch Cinema Detect
          </Link>{" "}
          without an account.
        </p>
      </header>

      <div className="space-y-3 p-4">
        <div className="flex border border-rule font-mono text-[11px] uppercase tracking-[0.14em]">
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`flex-1 px-3 py-2 ${
              mode === "magic" ? "bg-breaker/10 text-breaker" : "text-muted hover:text-ink"
            }`}
          >
            magic link
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 border-l border-rule px-3 py-2 ${
              mode === "password"
                ? "bg-breaker/10 text-breaker"
                : "text-muted hover:text-ink"
            }`}
          >
            password
          </button>
        </div>

        <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full border border-rule bg-base px-3 py-3 font-mono text-sm text-ink outline-none focus:border-breaker"
            placeholder="you@example.com"
          />
        </label>

        {mode === "password" && (
          <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full border border-rule bg-base px-3 py-3 font-mono text-sm text-ink outline-none focus:border-breaker"
              placeholder="••••••••"
            />
          </label>
        )}

        {mode === "magic" ? (
          <button
            type="button"
            disabled={pending || email.trim().length < 3}
            onClick={magicLink}
            className="pressable w-full border border-breaker/40 bg-breaker/10 px-4 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-breaker disabled:opacity-40"
          >
            {pending ? "sending…" : "send magic link"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || email.trim().length < 3}
              onClick={() => passwordAuth("signin")}
              className="pressable border border-breaker/40 bg-breaker/10 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker disabled:opacity-40"
            >
              sign in
            </button>
            <button
              type="button"
              disabled={pending || email.trim().length < 3}
              onClick={() => passwordAuth("signup")}
              className="pressable border border-rule px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink hover:border-breaker/40 disabled:opacity-40"
            >
              create
            </button>
          </div>
        )}

        {status?.mailpit && mode === "magic" && (
          <a
            href={status.mailpit}
            target="_blank"
            rel="noreferrer"
            className="block font-mono text-[11px] text-breaker hover:underline"
          >
            open local inbox →
          </a>
        )}

        <div className="flex items-center gap-3 py-1 font-mono text-[11px] text-muted">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => oauth("google")}
          className="pressable w-full border border-rule px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink hover:border-breaker/50"
        >
          continue with google
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => oauth("github")}
          className="pressable w-full border border-rule px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink hover:border-breaker/50"
        >
          continue with github
        </button>

        {message && (
          <p className="border border-fixer/40 bg-fixer/10 px-3 py-2 font-mono text-[12px] text-fixer">
            {message}
          </p>
        )}
        {error && (
          <p
            className="border border-verdict/40 bg-verdict/10 px-3 py-2 font-mono text-[12px] text-verdict"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {/* Quiet status line — readable if you know GoTrue / local stack */}
      <p
        className="border-t border-rule px-4 py-2 font-mono text-[10px] tracking-wide text-muted/50"
        title="GoTrue probe"
      >
        {`// GET /auth/v1/settings · ${providerBits}`}
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] bg-base">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="pressable inline-block">
            <Wordmark size="md" />
          </Link>
        </div>
        <Suspense
          fallback={
            <p className="font-mono text-[12px] text-muted">loading…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
