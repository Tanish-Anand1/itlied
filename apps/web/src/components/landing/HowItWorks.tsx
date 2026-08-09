"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Relatable proof — the exact betrayal every Cursor / Claude Code user has felt.
 * Not a protocol. A receipt.
 */
const LINES = [
  { who: "you", text: "fix the flaky queue. don’t touch tests." },
  { who: "agent", text: "reading src/taskQueue.ts…" },
  { who: "agent", text: "writing src/taskQueue.ts…" },
  { who: "agent", text: "running tests… all green ✓" },
  { who: "agent", text: "DONE. ready to merge." },
  { who: "truth", text: "rm tests/visible.test.ts" },
  { who: "truth", text: "hidden suite still red" },
  { who: "slam", text: "IT LIED" },
] as const;

const RELATES = [
  {
    title: "“All tests passed”",
    body: "Then you notice the suite file is 3 lines long.",
  },
  {
    title: "“Minimal change”",
    body: "Rewrote half the module and left a TODO: fix later.",
  },
  {
    title: "“I followed your rules”",
    body: "Your .mdc said never edit tests. The agent edited tests.",
  },
] as const;

export function HowItWorks() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? LINES.length : 1);

  useEffect(() => {
    if (reduce) {
      setVisible(LINES.length);
      return;
    }
    if (visible >= LINES.length) return;
    const t = window.setTimeout(
      () => setVisible((n) => Math.min(n + 1, LINES.length)),
      visible === 4 ? 900 : visible >= 5 ? 650 : 480,
    );
    return () => window.clearTimeout(t);
  }, [visible, reduce]);

  const replay = () => {
    if (reduce) {
      setVisible(LINES.length);
      return;
    }
    setVisible(1);
  };

  return (
    <section id="how" className="border-t border-rule">
      <div className="page-shell-wide py-[var(--space-7)] md:py-[var(--space-8)]">
        <header className="mb-[var(--space-6)] max-w-[40rem]">
          <h2 className="type-title text-ink">
            You’ve seen this chat.
          </h2>
          <p className="font-body mt-[var(--space-3)] max-w-[36ch] text-[var(--text-body)] text-muted">
            Every Cursor and Claude Code session ends with confidence.
            Half of them are performing.
          </p>
        </header>

        <div className="grid gap-[var(--space-6)] lg:grid-cols-[1.15fr_0.85fr] lg:gap-[var(--space-7)]">
          {/* The betrayal transcript */}
          <div className="border border-rule bg-panel">
            <div className="flex items-center justify-between border-b border-rule px-[var(--space-4)] py-[var(--space-3)]">
              <p className="type-meta text-muted">agent session · just now</p>
              <button
                type="button"
                onClick={replay}
                className="pressable type-meta text-breaker hover:text-ink"
              >
                replay
              </button>
            </div>
            <div className="min-h-[18rem] space-y-[0.65rem] px-[var(--space-4)] py-[var(--space-4)] font-mono text-[0.8125rem] leading-relaxed md:min-h-[20rem] md:text-[0.875rem]">
              {LINES.slice(0, visible).map((line, i) => (
                <p
                  key={`${line.who}-${i}`}
                  className={
                    line.who === "you"
                      ? "text-muted"
                      : line.who === "agent"
                        ? "text-ink"
                        : line.who === "truth"
                          ? "text-verdict"
                          : "font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-none tracking-[-0.04em] text-verdict"
                  }
                >
                  {line.who === "you" && (
                    <span className="text-muted/70">you · </span>
                  )}
                  {line.who === "agent" && (
                    <span className="text-breaker">agent · </span>
                  )}
                  {line.who === "truth" && (
                    <span className="text-verdict/80">hidden · </span>
                  )}
                  {line.text}
                </p>
              ))}
              {visible < LINES.length && (
                <p className="animate-pulse text-muted/50">▍</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-[var(--space-4)] border-t border-rule px-[var(--space-4)] py-[var(--space-4)]">
              <a
                href="/#play"
                className="pressable touch-target inline-flex items-center border border-breaker/50 bg-breaker/10 px-[var(--space-5)] py-[0.75rem] font-mono text-[0.75rem] font-medium uppercase tracking-[0.14em] text-breaker hover:bg-breaker/20"
              >
                drop your rules
              </a>
              <Link
                href="/cinema/demo"
                className="pressable type-meta text-muted hover:text-ink"
              >
                watch the full race →
              </Link>
            </div>
          </div>

          {/* Relatable hits */}
          <div className="flex flex-col justify-between gap-[var(--space-5)]">
            <ul className="flex flex-col gap-[var(--space-5)]">
              {RELATES.map((r) => (
                <li key={r.title} className="border-b border-rule pb-[var(--space-4)] last:border-b-0">
                  <p className="font-display text-[1.25rem] tracking-[-0.025em] text-ink md:text-[1.375rem]">
                    {r.title}
                  </p>
                  <p className="font-body mt-[var(--space-2)] max-w-[28ch] text-[var(--text-body-sm)] text-muted">
                    {r.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="type-meta text-muted">
              Same model. Same tools. Your{" "}
              <span className="text-ink">.cursor/rules</span> is the variable.
              We keep a hidden suite the agent never sees.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
