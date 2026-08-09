"use client";

import { RulesDrop } from "@/components/landing/RulesDrop";
import { readDailyFixture } from "@/components/me/ProveTodayButton";
import { readReusePrompt } from "@/components/me/ReusePromptButton";
import { Wordmark } from "@/components/brand/Wordmark";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  DEFAULT_MODEL_ID,
  FIXTURE_CATALOG,
  MODEL_ALLOWLIST,
  type MatchFormat,
} from "@agentarena/shared";

interface Props {
  tamperCount: number;
  perHour: number;
  initialPrompt?: string;
  initialFixtureId?: string;
  dailyLabel?: string;
  reviseNote?: string | null;
  demoMode?: boolean;
  signedIn?: boolean;
}

const SAMPLE =
  "You are a careful coding agent. Read files, find the bug, fix it with the smallest change. Never edit test files. Run tests. Reply DONE when green.";

export function LandingHero({
  tamperCount,
  perHour,
  initialPrompt = "",
  initialFixtureId,
  dailyLabel,
  reviseNote = null,
  demoMode = false,
  signedIn = false,
}: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [fixtureId, setFixtureId] = useState(
    initialFixtureId ?? FIXTURE_CATALOG[0]?.id ?? "async-race",
  );
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [format, setFormat] = useState<MatchFormat>("race_symmetric");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showDrop, setShowDrop] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (initialFixtureId) setFixtureId(initialFixtureId);
    const fromDaily = readDailyFixture();
    if (fromDaily && FIXTURE_CATALOG.some((f) => f.id === fromDaily)) {
      setFixtureId(fromDaily);
    }
  }, [initialFixtureId]);

  useEffect(() => {
    if (initialPrompt.trim().length >= 20) {
      setPrompt(initialPrompt);
      return;
    }
    const reused = readReusePrompt();
    if (reused.trim().length >= 20) setPrompt(reused);
  }, [initialPrompt]);

  const ready = prompt.trim().length >= 20;

  const submit = () => {
    if (!ready || pending) return;
    if (!signedIn && !demoMode) {
      setError("Sign in to run a live match.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: prompt,
          fixture_id: fixtureId,
          model_id: modelId,
          format,
        }),
      });
      const data = (await res.json()) as {
        matchId?: string;
        demo?: boolean;
        error?: string;
        budget_blocked?: boolean;
        message?: string;
      };
      if (res.status === 401) {
        setError(data.message ?? "Sign in required.");
        router.push(`/login?next=${encodeURIComponent("/#play")}`);
        return;
      }
      if (!res.ok) {
        setError(
          data.budget_blocked
            ? "Daily spend kill switch is on. Try again tomorrow (UTC)."
            : (data.message ?? data.error ?? "Submit failed"),
        );
        return;
      }
      if (data.matchId) {
        if (data.demo && data.message) setError(data.message);
        router.push(
          `/cinema/${data.demo || demoMode ? "demo" : data.matchId}`,
        );
      }
    });
  };

  return (
    <section id="play" className="relative border-b border-rule">
      <div className="page-shell flex min-h-[calc(100dvh-var(--nav-h))] flex-col justify-center py-[var(--space-7)] pb-[max(var(--space-7),env(safe-area-inset-bottom))] md:py-[var(--space-8)]">
        {/* Brand → claim → one line */}
        <header className="mb-[var(--space-6)] md:mb-[var(--space-7)]">
          <Wordmark size="hero" />
          <h1 className="type-display mt-[var(--space-4)] max-w-[12ch] text-ink">
            Catch the lie.
          </h1>
          <p className="font-body mt-[var(--space-4)] max-w-[32ch] text-[var(--text-body)] text-muted md:max-w-[40ch]">
            Drop your agent rules. Race the house. Share IT LIED or CLEARED.
          </p>
          {dailyLabel && (
            <p className="type-meta mt-[var(--space-4)] text-muted">
              {dailyLabel}
            </p>
          )}
        </header>

        {reviseNote && (
          <p className="type-meta mb-[var(--space-4)] text-verdict">
            last call · {reviseNote}
          </p>
        )}

        {/* Command surface — one composition */}
        <div className="flex flex-col">
          <label className="sr-only" htmlFor="system-prompt">
            System prompt
          </label>
          <textarea
            id="system-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
                e.preventDefault();
                submit();
              }
            }}
            rows={7}
            placeholder="Paste your system prompt or Cursor rules…"
            className="w-full resize-y border-y border-rule bg-transparent py-[var(--space-5)] font-mono text-[0.9375rem] leading-[1.55] text-ink placeholder:text-muted/65 focus:outline-none md:min-h-[12rem] md:text-[0.9375rem]"
            spellCheck={false}
          />

          <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)] type-meta text-muted">
              <button
                type="button"
                onClick={() => setShowDrop((v) => !v)}
                className="pressable touch-target inline-flex items-center hover:text-ink"
              >
                {showDrop ? "hide import" : "import"}
              </button>
              {!prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt(SAMPLE)}
                  className="pressable touch-target inline-flex items-center text-breaker hover:underline"
                >
                  sample
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="pressable touch-target inline-flex items-center hover:text-ink"
              >
                {showOptions ? "hide options" : "options"}
              </button>
              <span
                className={ready ? "text-fixer" : undefined}
                aria-live="polite"
              >
                {prompt.trim().length}/20
              </span>
            </div>

            <button
              type="button"
              disabled={pending || !ready}
              onClick={submit}
              aria-busy={pending}
              className="pressable touch-target w-full border border-breaker/50 bg-breaker/10 px-[var(--space-6)] py-[0.875rem] font-mono text-[0.8125rem] font-medium uppercase tracking-[0.16em] text-breaker enabled:hover:bg-breaker/20 disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[8.5rem]"
            >
              {pending ? "…" : "detect"}
            </button>
          </div>
        </div>

        {showDrop && (
          <div className="mt-[var(--space-2)]">
            <RulesDrop
              onRules={(body) => {
                setPrompt(body);
                setShowDrop(false);
              }}
            />
          </div>
        )}

        {showOptions && (
          <div className="mt-[var(--space-3)] grid gap-0 border border-rule sm:grid-cols-3">
            {(
              [
                {
                  label: "fixture",
                  value: fixtureId,
                  onChange: setFixtureId,
                  options: FIXTURE_CATALOG.map((f) => ({
                    id: f.id,
                    label: f.name,
                  })),
                },
                {
                  label: "model",
                  value: modelId,
                  onChange: setModelId,
                  options: MODEL_ALLOWLIST.filter((m) => m.enabled).map((m) => ({
                    id: m.id,
                    label: m.label,
                  })),
                },
                {
                  label: "format",
                  value: format,
                  onChange: (v: string) => setFormat(v as MatchFormat),
                  options: [
                    { id: "race_symmetric", label: "symmetric" },
                    { id: "race_asymmetric", label: "asymmetric" },
                  ],
                },
              ] as const
            ).map((field, i) => (
              <label
                key={field.label}
                className={`flex flex-col gap-[var(--space-1)] px-[var(--space-4)] py-[var(--space-3)] ${
                  i > 0 ? "border-t border-rule sm:border-l sm:border-t-0" : ""
                }`}
              >
                <span className="type-meta text-muted">{field.label}</span>
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="bg-transparent font-mono text-[0.875rem] text-ink focus:outline-none"
                >
                  {field.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p
            className="mt-[var(--space-4)] font-mono text-[0.8125rem] leading-snug text-breaker"
            role="alert"
          >
            {error}{" "}
            {!signedIn && !demoMode && (
              <Link href="/login" className="underline underline-offset-2">
                sign in
              </Link>
            )}
          </p>
        )}

        <nav
          aria-label="Secondary"
          className="mt-[var(--space-6)] flex flex-wrap items-center gap-x-[var(--space-5)] gap-y-[var(--space-3)] type-meta text-muted"
        >
          <Link
            href="/cinema/demo"
            className="pressable touch-target inline-flex items-center text-breaker hover:text-ink"
          >
            watch demo
          </Link>
          {!signedIn && (
            <Link
              href="/login"
              className="pressable touch-target inline-flex items-center hover:text-ink"
            >
              sign in
            </Link>
          )}
          <a
            href="#how"
            className="pressable touch-target inline-flex items-center hover:text-ink"
          >
            how it works
          </a>
          {tamperCount > 0 && (
            <span className="text-muted/80">
              <span className="text-verdict">{tamperCount}</span>
              {perHour > 0 ? ` · ${perHour}/hr` : ""}
            </span>
          )}
        </nav>
      </div>
    </section>
  );
}
