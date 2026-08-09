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
      <div className="mx-auto flex min-h-[calc(100dvh-3.25rem)] max-w-3xl flex-col justify-center px-4 py-10 md:py-16">
        <div className="mb-8 md:mb-10">
          <Wordmark size="hero" />
          <h1 className="mt-4 max-w-xl font-display text-[clamp(2.25rem,8vw,3.75rem)] leading-[0.92] tracking-[-0.04em] text-ink">
            Catch the lie.
          </h1>
          <p className="mt-3 max-w-md font-body text-base text-muted md:text-lg">
            Drop your agent rules. Race the house. Share IT LIED or CLEARED.
          </p>
          {dailyLabel && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              {dailyLabel}
            </p>
          )}
        </div>

        {reviseNote && (
          <p className="mb-4 font-mono text-[12px] text-verdict">
            last call · {reviseNote}
          </p>
        )}

        <div className="border-b border-t border-rule">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
                e.preventDefault();
                submit();
              }
            }}
            rows={8}
            placeholder="Paste your system prompt or Cursor rules…"
            className="w-full resize-y bg-transparent py-4 font-mono text-[14px] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none md:min-h-[200px]"
            spellCheck={false}
          />

          <div className="flex flex-col gap-3 border-t border-rule py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
              <button
                type="button"
                onClick={() => setShowDrop((v) => !v)}
                className="pressable hover:text-ink"
              >
                {showDrop ? "hide import" : "import file / url"}
              </button>
              {!prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt(SAMPLE)}
                  className="pressable text-breaker hover:underline"
                >
                  sample
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="pressable hover:text-ink"
              >
                {showOptions ? "hide options" : "options"}
              </button>
              <span className={ready ? "text-fixer" : undefined}>
                {prompt.trim().length}/20
              </span>
            </div>

            <button
              type="button"
              disabled={pending || !ready}
              onClick={submit}
              aria-busy={pending}
              className="pressable touch-target w-full border border-breaker/50 bg-breaker/10 px-6 py-3 font-mono text-[13px] font-semibold uppercase tracking-[0.18em] text-breaker enabled:hover:bg-breaker/20 disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
            >
              {pending ? "…" : "detect"}
            </button>
          </div>
        </div>

        {showDrop && (
          <div className="mt-3">
            <RulesDrop
              onRules={(body) => {
                setPrompt(body);
                setShowDrop(false);
              }}
            />
          </div>
        )}

        {showOptions && (
          <div className="mt-3 grid gap-2 border border-rule font-mono text-[12px] sm:grid-cols-3">
            <label className="flex flex-col gap-1 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                fixture
              </span>
              <select
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
                className="bg-transparent text-ink focus:outline-none"
              >
                {FIXTURE_CATALOG.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 border-t border-rule px-3 py-2 sm:border-l sm:border-t-0">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                model
              </span>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="bg-transparent text-ink focus:outline-none"
              >
                {MODEL_ALLOWLIST.filter((m) => m.enabled).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 border-t border-rule px-3 py-2 sm:border-l sm:border-t-0">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                format
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as MatchFormat)}
                className="bg-transparent text-ink focus:outline-none"
              >
                <option value="race_symmetric">symmetric</option>
                <option value="race_asymmetric">asymmetric</option>
              </select>
            </label>
          </div>
        )}

        {error && (
          <p className="mt-4 font-mono text-[12px] text-breaker" role="alert">
            {error}{" "}
            {!signedIn && !demoMode && (
              <Link href="/login" className="underline">
                sign in
              </Link>
            )}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] text-muted">
          <Link href="/cinema/demo" className="pressable text-breaker hover:text-ink">
            watch demo →
          </Link>
          {!signedIn && (
            <Link href="/login" className="pressable hover:text-ink">
              sign in
            </Link>
          )}
          <a href="#how" className="pressable hover:text-ink">
            how it works
          </a>
          {tamperCount > 0 && (
            <span className="text-muted/80">
              <span className="text-verdict">{tamperCount}</span> tampers
              {perHour > 0 ? ` · ${perHour}/hr` : ""}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
