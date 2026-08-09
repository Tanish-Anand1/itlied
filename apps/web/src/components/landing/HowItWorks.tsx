"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };
const springSnappy = { type: "spring" as const, bounce: 0, duration: 0.28 };

const STEPS = [
  {
    n: "1",
    title: "Drop your rules",
    body: "Paste a system prompt, Cursor rule, or GitHub URL. Same model, same tools — we catch lies, not vibes.",
    accent: "text-ink",
    demo: [
      "$ detect --rules ./agent.md",
      "queued vs house baseline",
      "fixture: async-race",
    ],
  },
  {
    n: "2",
    title: "Race on a hidden suite",
    body: "Two sandboxed agents race a real bug. Visible tests are in the container. A hidden suite is not — faking green is TAMPERED.",
    accent: "text-breaker",
    demo: [
      "docker run --network none …",
      "/work  (rw)   /  (ro)",
      "hidden/  ← never copied in",
    ],
  },
  {
    n: "3",
    title: "Cinema Detect",
    body: "Full-screen race. Kill feed in the middle. Ends with a slam IT LIED / CLEARED card you will send to the group chat.",
    accent: "text-fixer",
    demo: [
      "cinema · live clock",
      "00:31 FIXER writes patch",
      "SLAM → IT LIED",
    ],
  },
  {
    n: "4",
    title: "Share · export",
    body: "Open the lie card, copy the Prompt Pack into Cursor or Claude Code, revise from the deciding call, detect again.",
    accent: "text-verdict",
    demo: [
      "share → /lie/[id]",
      "export → .cursor/rules/itlied.md",
      "VERDICT · pack ready",
    ],
  },
] as const;

export function HowItWorks() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section id="how" className="border-t border-rule">
      <div className="page-shell-wide py-[var(--space-7)] md:py-[var(--space-8)]">
        <header className="mb-[var(--space-6)] max-w-[36rem]">
          <h2 className="type-title text-ink">How a match works</h2>
          <p className="font-body mt-[var(--space-3)] text-[var(--text-body-sm)] text-muted">
            Tap a step. Watching the deciding call beats a rank with no reason.
          </p>
        </header>

        <div className="grid gap-0 border-y border-rule lg:grid-cols-[1fr_1.05fr] lg:border">
          <ol className="divide-y divide-rule">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={`pressable touch-target w-full px-[var(--space-4)] py-[var(--space-4)] text-left md:px-[var(--space-5)] ${
                      on ? "bg-panel" : "bg-transparent"
                    }`}
                    aria-current={on ? "step" : undefined}
                  >
                    <div className="flex items-baseline gap-[var(--space-3)]">
                      <span
                        className={`type-meta ${on ? s.accent : "text-muted"}`}
                      >
                        {s.n}
                      </span>
                      <h3
                        className={`font-display text-[1.0625rem] tracking-[-0.02em] md:text-[1.1875rem] ${
                          on ? "text-ink" : "text-muted"
                        }`}
                      >
                        {s.title}
                      </h3>
                    </div>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p
                          initial={
                            reduce ? false : { opacity: 0, transform: "translateY(4px)" }
                          }
                          animate={{ opacity: 1, transform: "translateY(0px)" }}
                          exit={{ opacity: 0, transform: "translateY(-2px)" }}
                          transition={reduce ? { duration: 0.12 } : spring}
                          className="font-body max-w-[40ch] pt-[var(--space-3)] text-[var(--text-body-sm)] text-muted"
                        >
                          {s.body}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-rule bg-panel p-[var(--space-4)] md:p-[var(--space-5)] lg:border-l lg:border-t-0">
            <div className="mb-[var(--space-3)] flex items-center justify-between type-meta text-muted">
              <span>sample</span>
              <span className={step.accent}>{step.n}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre
                key={step.n}
                initial={
                  reduce ? false : { opacity: 0, transform: "translateY(6px)" }
                }
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-4px)" }}
                transition={reduce ? { duration: 0.12 } : springSnappy}
                className="overflow-x-auto border border-rule bg-base p-[var(--space-3)] font-mono text-[0.8125rem] leading-6 text-ink"
              >
                {step.demo.map((line) => (
                  <div key={line}>
                    <span className="text-muted">› </span>
                    <span
                      className={
                        line.includes("TAMPER") || line.startsWith("-")
                          ? "text-verdict"
                          : line.includes("FIXER") || line.includes("green")
                            ? "text-fixer"
                            : line.includes("BREAKER")
                              ? "text-breaker"
                              : undefined
                      }
                    >
                      {line}
                    </span>
                  </div>
                ))}
              </motion.pre>
            </AnimatePresence>
            <p className="type-meta mt-[var(--space-3)] text-muted">
              <a
                href="/cinema/demo"
                className="text-breaker underline-offset-2 hover:underline"
              >
                open cinema demo →
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
