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
  const [usePassword, setUsePassword] = useState(false);
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
            mailpit: null,
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
        setError("Auth is offline. Try again in a moment.");
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
        setError("Auth is offline. Try again in a moment.");
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
          setMessage("Account created. Confirm email if needed, then sign in.");
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
        setError("Auth is offline. Try again in a moment.");
        return;
      }
      if (provider === "google" && !status.google) {
        setError("Google sign-in is not enabled yet.");
        return;
      }
      if (provider === "github" && !status.github) {
        setError("GitHub sign-in is not enabled yet.");
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

  const showGoogle = Boolean(status?.google);
  const showGithub = Boolean(status?.github);

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-[clamp(2.5rem,10vw,3.25rem)] leading-none tracking-[-0.04em] text-ink">
        Sign in
      </h1>
      <p className="mt-2 font-body text-sm text-muted">
        Needed to run a live detect.{" "}
        <Link href="/cinema/demo" className="text-breaker hover:underline">
          Watch the demo
        </Link>{" "}
        without an account.
      </p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full border-b border-rule bg-transparent py-3 font-mono text-[15px] text-ink outline-none focus:border-breaker"
            placeholder="you@example.com"
          />
        </label>

        {usePassword && (
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full border-b border-rule bg-transparent py-3 font-mono text-[15px] text-ink outline-none focus:border-breaker"
              placeholder="••••••••"
            />
          </label>
        )}

        {!usePassword ? (
          <button
            type="button"
            disabled={pending || email.trim().length < 3}
            onClick={magicLink}
            className="pressable touch-target w-full border border-breaker/40 bg-breaker/10 px-4 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em] text-breaker disabled:opacity-40"
          >
            {pending ? "sending…" : "send magic link"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || email.trim().length < 3}
              onClick={() => passwordAuth("signin")}
              className="pressable touch-target border border-breaker/40 bg-breaker/10 px-3 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker disabled:opacity-40"
            >
              sign in
            </button>
            <button
              type="button"
              disabled={pending || email.trim().length < 3}
              onClick={() => passwordAuth("signup")}
              className="pressable touch-target border border-rule px-3 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink hover:border-breaker/40 disabled:opacity-40"
            >
              create
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setUsePassword((v) => !v)}
          className="pressable font-mono text-[11px] text-muted hover:text-ink"
        >
          {usePassword ? "use magic link instead" : "use password instead"}
        </button>

        {(showGoogle || showGithub) && (
          <div className="space-y-2 pt-2">
            {showGoogle && (
              <button
                type="button"
                disabled={pending}
                onClick={() => oauth("google")}
                className="pressable touch-target w-full border border-rule px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink hover:border-breaker/40"
              >
                continue with google
              </button>
            )}
            {showGithub && (
              <button
                type="button"
                disabled={pending}
                onClick={() => oauth("github")}
                className="pressable touch-target w-full border border-rule px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink hover:border-breaker/40"
              >
                continue with github
              </button>
            )}
          </div>
        )}

        {status?.mailpit && !usePassword && (
          <a
            href={status.mailpit}
            target="_blank"
            rel="noreferrer"
            className="block font-mono text-[11px] text-breaker hover:underline"
          >
            open local inbox →
          </a>
        )}

        {message && (
          <p className="font-mono text-[12px] text-fixer">{message}</p>
        )}
        {error && (
          <p className="font-mono text-[12px] text-verdict" role="alert">
            {error === "auth_not_configured"
              ? "Auth is not fully configured yet."
              : error}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative z-[1] min-h-[100dvh] px-4">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
        <div className="pt-6">
          <Link href="/" className="pressable inline-block">
            <Wordmark size="sm" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col justify-center py-12">
          <Suspense
            fallback={
              <p className="font-mono text-[12px] text-muted">loading…</p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
