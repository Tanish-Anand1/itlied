"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Traction-facing proof story for Cursor / Claude Code builders.
 * One job: make a dev want to paste their rules and hit detect.
 */
const BEATS = [
  {
    id: "lie",
    title: "Your rules look busy. They may still lie.",
    body: "Agents pass visible tests, delete suites, or stall until the clock dies. You ship vibes. We catch the cheat.",
    proof: "TAMPERED · deleted tests/visible.test.ts",
  },
  {
    id: "race",
    title: "Same model. Same tools. Only the prompt changes.",
    body: "Your Cursor / Claude rules race a fixed house baseline on a real buggy fixture. First to clear the hidden suite wins.",
    proof: "BREAKER vs HOUSE · async-race · Fireworks / NVIDIA",
  },
  {
    id: "slam",
    title: "Cinema Detect ends with a card you will share.",
    body: "Full-screen kill feed. Then a slam: IT LIED or CLEARED. Drop it in Discord / Twitter. The loop is the product.",
    proof: "IT LIED · open /lie/[id]",
  },
  {
    id: "export",
    title: "Export only what clears.",
    body: "Copy a Cursor .mdc or CLAUDE.md block with the deciding call. Revise from the failure. Prove again tomorrow.",
    proof: "Prompt Pack → .cursor/rules/itlied.mdc",
  },
] as const;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const beat = BEATS[active];

  return (
    <section id="how" className="border-t border-rule">
      <div className="page-shell-wide py-[var(--space-7)] md:py-[var(--space-8)]">
        <header className="mb-[var(--space-6)] max-w-[36rem]">
          <h2 className="type-title text-ink">
            Built for people who ship agent rules
          </h2>
          <p className="font-body mt-[var(--space-3)] text-[var(--text-body-sm)] text-muted">
            Not another model leaderboard. A lie detector for the prompts you
            already paste into Cursor and Claude Code.
          </p>
        </header>

        <div className="grid gap-[var(--space-6)] lg:grid-cols-[1fr_1.1fr] lg:gap-[var(--space-7)]">
          <ol className="flex flex-col gap-[var(--space-2)]">
            {BEATS.map((b, i) => {
              const on = i === active;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={`pressable touch-target w-full border px-[var(--space-4)] py-[var(--space-4)] text-left transition-colors ${
                      on
                        ? "border-breaker/40 bg-breaker/5"
                        : "border-transparent hover:border-rule"
                    }`}
                    aria-current={on ? "true" : undefined}
                  >
                    <p
                      className={`font-display text-[1.125rem] tracking-[-0.02em] md:text-[1.25rem] ${
                        on ? "text-ink" : "text-muted"
                      }`}
                    >
                      {b.title}
                    </p>
                    {on && (
                      <p className="font-body mt-[var(--space-2)] max-w-[42ch] text-[var(--text-body-sm)] text-muted">
                        {b.body}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <aside className="flex flex-col justify-between border border-rule bg-panel p-[var(--space-5)]">
            <div>
              <p className="type-meta text-muted">what you get</p>
              <p className="font-display mt-[var(--space-3)] text-[clamp(1.75rem,5vw,2.25rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                {beat.title}
              </p>
              <p className="font-body mt-[var(--space-4)] max-w-[36ch] text-[var(--text-body-sm)] text-muted">
                {beat.body}
              </p>
              <pre className="mt-[var(--space-5)] overflow-x-auto border border-rule bg-base px-[var(--space-3)] py-[var(--space-3)] font-mono text-[0.8125rem] leading-relaxed text-breaker">
                {beat.proof}
              </pre>
            </div>

            <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center">
              <a
                href="/#play"
                className="pressable touch-target inline-flex items-center justify-center border border-breaker/50 bg-breaker/10 px-[var(--space-5)] py-[0.875rem] font-mono text-[0.8125rem] font-medium uppercase tracking-[0.14em] text-breaker hover:bg-breaker/20"
              >
                paste rules · detect
              </a>
              <Link
                href="/cinema/demo"
                className="pressable touch-target inline-flex items-center justify-center type-meta text-muted hover:text-ink"
              >
                watch a tamper in 6s →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
