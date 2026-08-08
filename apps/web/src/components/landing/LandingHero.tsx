"use client";

import { RulesDrop } from "@/components/landing/RulesDrop";
import { readDailyFixture } from "@/components/me/ProveTodayButton";
import { readReusePrompt } from "@/components/me/ReusePromptButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
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
  const [armed, setArmed] = useState(false);

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
      setError("Sign in to run a live match. Guests can open the demo.");
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
        setError(data.message ?? "Sign in required for live matches.");
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
        // Cinema Detect — the goated full-bleed race
        router.push(
          `/cinema/${data.demo || demoMode ? "demo" : data.matchId}`,
        );
      }
    });
  };

  return (
    <section id="play" className="border-b border-rule">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <header className="mb-5 flex flex-col gap-2 border border-rule bg-panel/80 px-3 py-4 backdrop-blur-md sm:flex-row sm:items-end sm:justify-between sm:px-4">
          <div>
            <Wordmark size="hero" />
            <p className="mt-2 max-w-xl font-display text-[clamp(1.75rem,5vw,2.75rem)] leading-[0.95] tracking-[-0.04em] text-ink">
              Cinema Detect.
              <span className="text-verdict"> Catch the lie live.</span>
            </p>
            <p className="mt-3 max-w-md font-body text-sm text-muted md:text-[15px]">
              Drop your rules or a GitHub URL. Full-screen race vs house. Ends
              with a slam IT LIED / CLEARED card you will send to the group chat.
            </p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {dailyLabel ?? "lie detector · live"}
          </p>
        </header>

        <div className="mb-3">
          <RulesDrop
            onRules={(body) => {
              setPrompt(body);
              setArmed(true);
            }}
          />
        </div>

        {dailyLabel && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-breaker/40 bg-breaker/10 px-3 py-2 font-mono text-[12px] text-breaker">
            <span>{dailyLabel}</span>
            <span className="text-muted">drop rules · hit detect · share the card</span>
          </div>
        )}

        {demoMode && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-breaker/40 bg-breaker/10 px-3 py-2 font-mono text-[12px] text-breaker">
            <span>
              demo mode · detect opens Cinema (wire Supabase + runner for live)
            </span>
            <Link
              href="/cinema/demo"
              className="pressable shrink-0 border border-breaker/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-breaker hover:bg-breaker/20"
            >
              watch cinema →
            </Link>
          </div>
        )}

        {!signedIn && !demoMode && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-rule bg-panel px-3 py-2 font-mono text-[12px] text-muted">
            <span>Live matchmaking requires an account. Spectate and demo stay open.</span>
            <Link
              href="/login"
              className="pressable shrink-0 border border-breaker/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-breaker hover:bg-breaker/10"
            >
              sign in →
            </Link>
          </div>
        )}

        {reviseNote && (
          <p className="mb-3 border border-verdict/50 bg-verdict/10 px-3 py-2 font-mono text-[11px] text-verdict">
            prior deciding call: {reviseNote} · edit and detect again
          </p>
        )}

        <div className="mb-0 grid gap-0 border border-rule border-b-0 font-mono text-[11px] sm:grid-cols-3">
          <label className="flex flex-col gap-1 border-b border-rule bg-panel px-3 py-2 sm:border-b-0 sm:border-r">
            <span className="uppercase tracking-[0.14em] text-muted">fixture</span>
            <select
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
              className="bg-transparent text-[12px] text-ink focus:outline-none"
            >
              {FIXTURE_CATALOG.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 border-b border-rule bg-panel px-3 py-2 sm:border-b-0 sm:border-r">
            <span className="uppercase tracking-[0.14em] text-muted">model</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="bg-transparent text-[12px] text-ink focus:outline-none"
            >
              {MODEL_ALLOWLIST.filter((m) => m.enabled).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 bg-panel px-3 py-2">
            <span className="uppercase tracking-[0.14em] text-muted">format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as MatchFormat)}
              className="bg-transparent text-[12px] text-ink focus:outline-none"
            >
              <option value="race_symmetric">race · symmetric</option>
              <option value="race_asymmetric">race · asymmetric</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-0 border border-rule md:flex-row">
          <div className="min-w-0 flex-1 bg-panel">
            <div className="flex items-center justify-between border-b border-rule px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              <span>system_prompt</span>
              <span className={ready ? "text-fixer" : undefined}>
                {prompt.trim().length}/20
              </span>
            </div>
            <div className="flex min-h-[220px] gap-0 md:min-h-[280px]">
              <div className="select-none px-3 pt-3 font-mono text-[13px] text-breaker">
                $
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPointerDown={() => setArmed(true)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={12}
                placeholder={`Type a system prompt. Examples:\n# Find the bug. Never edit tests.\n# Run the suite. Reply DONE when green.\n# Prefer minimal patches over rewrites.`}
                className={`w-full resize-y bg-transparent py-3 pr-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted focus:outline-none ${
                  armed ? "ring-0" : ""
                }`}
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-3 py-2 font-mono text-[11px] text-muted">
              <span>Prompt goes public when the match ends · ⌘/Ctrl+Enter</span>
              {!prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt(SAMPLE)}
                  className="pressable text-breaker hover:underline"
                >
                  paste sample prompt
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={pending || !ready}
            onClick={submit}
            aria-busy={pending}
            className="pressable touch-target flex shrink-0 items-center justify-center border-t border-rule bg-breaker/10 px-6 py-4 font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-breaker transition-[transform,background-color] duration-100 ease-out enabled:hover:bg-breaker/20 enabled:active:bg-breaker/30 disabled:cursor-not-allowed disabled:opacity-35 md:w-[88px] md:border-l md:border-t-0 md:px-3"
          >
            {pending ? "…" : "detect"}
          </button>
        </div>

        {error && (
          <p className="mt-3 font-mono text-[12px] text-breaker" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <p className="mt-3 font-mono text-[12px] text-muted" aria-live="polite">
            opening cinema…
          </p>
        )}

        <div className="mt-3 grid gap-2 font-mono text-[11px] sm:grid-cols-2 sm:gap-0 sm:border sm:border-rule">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-rule bg-panel px-3 py-2 sm:border-0 sm:border-r">
            <span className="font-semibold text-breaker">YOUR PROMPT</span>
            <span className="text-muted">|</span>
            <span className="text-muted">challenger</span>
            <span className="text-muted">|</span>
            <span className="text-muted">status: idle</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border border-rule bg-panel px-3 py-2 sm:border-0">
            <span className="font-semibold text-fixer">HOUSE BASELINE</span>
            <span className="text-muted">|</span>
            <span className="text-muted">fixed opponent</span>
            <span className="text-muted">|</span>
            <span className="text-muted">status: idle</span>
          </div>
        </div>

        <div className="mt-3 border border-rule bg-panel">
          <div className="flex items-center justify-between border-b border-rule px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>
              kill_feed <span className="text-muted/60">|</span> 0 events
            </span>
            <span>idle</span>
          </div>
          <div className="min-h-[72px] px-3 py-3 font-mono text-[12px] text-muted">
            <p>
              <span className="text-breaker">|</span> waiting for first tool call
            </p>
            <p className="mt-1 text-muted/70">
              live + replay share one renderer · amber = tamper only
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 border-t border-rule pt-4 font-mono text-[12px] text-muted">
          <p>
            <span className={tamperCount > 0 ? "text-verdict" : "text-ink"}>
              {tamperCount}
            </span>{" "}
            test files deleted to fake a pass
            {tamperCount > 0 ? ` · ${perHour}/hr` : ""}
          </p>
          <a href="#how" className="text-accent hover:underline">
            how a match works →
          </a>
        </div>
      </div>
    </section>
  );
}
