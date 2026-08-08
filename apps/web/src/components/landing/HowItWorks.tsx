"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };
const springSnappy = { type: "spring" as const, bounce: 0, duration: 0.28 };

const STEPS = [
  {
    n: "01",
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
    n: "02",
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
    n: "03",
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
    n: "04",
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
    <section id="how" className="border-t border-rule bg-base">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="mb-8 flex flex-col gap-2 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.045em] text-ink md:text-3xl">
              How a match works
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              protocol · four steps
            </p>
          </div>
          <p className="max-w-md font-body text-sm text-muted md:text-right">
            Click a step. Fifteen seconds of watching beats a rank with no reason.
          </p>
        </div>

        <div className="grid gap-0 border border-rule lg:grid-cols-[1fr_1.1fr]">
          <ol className="divide-y divide-rule">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={`pressable w-full px-4 py-4 text-left md:px-5 ${
                      on ? "bg-panel" : "bg-base"
                    }`}
                    aria-current={on ? "step" : undefined}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className={`font-mono text-[12px] ${on ? s.accent : "text-muted"}`}>
                        {s.n}
                      </span>
                      <h3
                        className={`font-display text-base font-bold tracking-[-0.02em] md:text-lg ${
                          on ? "text-ink" : "text-muted"
                        }`}
                      >
                        {s.title}
                      </h3>
                    </div>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p
                          initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
                          animate={{ opacity: 1, transform: "translateY(0px)" }}
                          exit={{ opacity: 0, transform: "translateY(-2px)" }}
                          transition={reduce ? { duration: 0.12 } : spring}
                          className="pt-3 font-body text-[14px] leading-relaxed text-muted"
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

          <div className="border-t border-rule bg-panel p-4 md:p-6 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              <span>sample</span>
              <span className={step.accent}>{step.n}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre
                key={step.n}
                initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-4px)" }}
                transition={reduce ? { duration: 0.12 } : springSnappy}
                className="overflow-x-auto border border-rule bg-base p-3 font-mono text-[12px] leading-6 text-ink"
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
            <p className="mt-3 font-mono text-[11px] text-muted">
              Try a dry run in{" "}
              <a href="#demo" className="text-breaker underline-offset-2 hover:underline">
                the sandbox ↓
              </a>
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-0 border border-rule font-mono text-[12px] text-muted md:grid-cols-3">
          <div className="border-b border-rule p-4 md:border-b-0 md:border-r">
            <div className="text-[10px] uppercase tracking-[0.18em]">sandbox</div>
            <p className="mt-2 text-ink">
              Fresh Docker per agent. Network none. Non-root. Keys never enter the container.
            </p>
          </div>
          <div className="border-b border-rule p-4 md:border-b-0 md:border-r">
            <div className="text-[10px] uppercase tracking-[0.18em]">limits</div>
            <p className="mt-2 text-ink">300s · 40 tool calls · 80k tokens · capped CPU/RAM</p>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-[0.18em]">reveal</div>
            <p className="mt-2 text-ink">
              Prompt private until the match ends — then public with the archive.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
