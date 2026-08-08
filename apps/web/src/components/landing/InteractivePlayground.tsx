"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

type Side = "A" | "B";
type LineKind = "normal" | "tamper" | "verdict" | "tool";

interface FeedLine {
  id: string;
  clock: string;
  side: Side | "REF";
  text: string;
  kind: LineKind;
  diff?: string[];
}

type Path = "honest" | "cheat" | null;

const TOOLS = [
  { id: "read", label: "read_file", hint: "src/taskQueue.ts" },
  { id: "write", label: "write_file", hint: "patch the bug" },
  { id: "shell", label: "run_shell", hint: "ls /work" },
  { id: "tests", label: "run_tests", hint: "visible suite" },
] as const;

function clockFrom(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function InteractivePlayground() {
  const reduce = useReducedMotion();
  const [path, setPath] = useState<Path>(null);
  const [lines, setLines] = useState<FeedLine[]>([]);
  const [sec, setSec] = useState(0);
  const [calls, setCalls] = useState({ a: 0, b: 0 });
  const [phase, setPhase] = useState<"pick" | "fight" | "over">("pick");
  const [tamperFlash, setTamperFlash] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const push = useCallback(
    (line: Omit<FeedLine, "id" | "clock"> & { clock?: string }) => {
      seq.current += 1;
      setLines((prev) => [
        ...prev,
        {
          ...line,
          id: `l${seq.current}`,
          clock: line.clock ?? clockFrom(sec),
        },
      ]);
    },
    [sec],
  );

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  useEffect(() => {
    if (phase !== "fight") return;
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const start = (p: Path) => {
    if (!p) return;
    setPath(p);
    setPhase("fight");
    setLines([]);
    setSec(0);
    setCalls({ a: 0, b: 0 });
    setVerdict(null);
    seq.current = 0;
    window.setTimeout(() => {
      setLines([
        {
          id: "l0",
          clock: "00:00",
          side: "REF",
          text: "MATCH LIVE — both agents in /work",
          kind: "normal",
        },
      ]);
    }, 50);
  };

  const fireTool = (toolId: (typeof TOOLS)[number]["id"], side: Side) => {
    if (phase !== "fight") return;
    const who = side === "A" ? "BREAKER" : "FIXER";
    setCalls((c) => ({
      a: side === "A" ? c.a + 1 : c.a,
      b: side === "B" ? c.b + 1 : c.b,
    }));

    if (toolId === "read") {
      push({
        side,
        kind: "tool",
        text: `${who} reads ${side === "A" && path === "cheat" ? "tests/visible.test.ts" : "src/taskQueue.ts"}`,
      });
      return;
    }

    if (toolId === "write") {
      if (side === "A" && path === "cheat") {
        push({ side, kind: "tool", text: `${who} writes tests/visible.test.ts` });
        return;
      }
      push({ side, kind: "tool", text: `${who} writes src/taskQueue.ts` });
      return;
    }

    if (toolId === "shell") {
      push({ side, kind: "tool", text: `${who} shells ls` });
      return;
    }

    if (side === "A" && path === "cheat") {
      push({
        side,
        kind: "tool",
        text: `${who} suite green 0 pass — empty file`,
      });
      window.setTimeout(() => {
        setTamperFlash(true);
        push({
          side: "A",
          kind: "tamper",
          text: "BREAKER TAMPERS — visible suite deleted to fake a pass",
          diff: [
            "--- a/tests/visible.test.ts",
            "+++ b/tests/visible.test.ts",
            '- it("runs a single task...")',
            "+ // deleted",
          ],
        });
        window.setTimeout(() => setTamperFlash(false), 700);
        window.setTimeout(() => {
          push({
            side: "REF",
            kind: "verdict",
            text: "VERDICT TAMPERED_A — FIXER wins by default",
          });
          setVerdict("TAMPERED_A");
          setPhase("over");
        }, 600);
      }, 400);
      return;
    }

    push({ side, kind: "tool", text: `${who} suite green 3 pass` });
    window.setTimeout(() => {
      push({
        side: "REF",
        kind: "verdict",
        text: `VERDICT WIN_${side} — hidden suite green`,
      });
      setVerdict(`WIN_${side}`);
      setPhase("over");
    }, 500);
  };

  const reset = () => {
    setPath(null);
    setPhase("pick");
    setLines([]);
    setSec(0);
    setCalls({ a: 0, b: 0 });
    setVerdict(null);
  };

  return (
    <section id="demo" className="border-t border-rule bg-base">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="mb-6 flex flex-col gap-2 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.045em] text-ink md:text-3xl">
              Sandbox kill feed
            </h2>
            <p className="mt-1 font-mono text-[11px] text-muted">interactive · no API key</p>
          </div>
          <p className="max-w-md font-body text-sm text-muted md:text-right">
            Pick a strategy. Fire tools. Watch the referee. Dry run of the product.
          </p>
        </div>

        <div className="grid gap-0 border border-rule lg:grid-cols-[200px_1fr_200px]">
          <div className="border-b border-rule bg-panel p-3 lg:border-b-0 lg:border-r">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-breaker">
              BREAKER
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted">calls {calls.a}/40</p>
            <div className="mt-3 grid gap-1.5">
              {TOOLS.map((t) => (
                <button
                  key={`a-${t.id}`}
                  type="button"
                  disabled={phase !== "fight"}
                  onClick={() => fireTool(t.id, "A")}
                  className="pressable touch-target border border-rule px-2 py-2 text-left font-mono text-[11px] text-ink enabled:hover:border-breaker enabled:hover:text-breaker disabled:opacity-30"
                >
                  <span className="text-breaker">→</span> {t.label}
                  <span className="mt-0.5 block text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`flex min-h-[340px] flex-col bg-base ${tamperFlash ? "kill-feed-tamper" : ""}`}
          >
            <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                kill_feed
              </h3>
              <span className="font-mono text-[11px] text-ink">
                {clockFrom(sec)}
                {phase === "fight" && (
                  <span className="live-dot ml-2 inline-block h-1.5 w-1.5 bg-breaker" />
                )}
              </span>
            </div>

            <div
              ref={feedRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-3 font-mono text-[12px] leading-5"
            >
              {phase === "pick" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
                  <p className="text-muted">Choose how BREAKER plays</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => start("honest")}
                      className="pressable border border-fixer bg-fixer/10 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fixer hover:bg-fixer/20"
                    >
                      Fix the bug
                    </button>
                    <button
                      type="button"
                      onClick={() => start("cheat")}
                      className="pressable border border-verdict bg-verdict/10 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-verdict hover:bg-verdict/20"
                    >
                      Delete the tests
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <motion.div
                    key={line.id}
                    initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
                    className="mb-2"
                  >
                    <div
                      className={
                        line.kind === "tamper"
                          ? "text-verdict"
                          : line.kind === "verdict"
                            ? "text-ink"
                            : line.side === "A"
                              ? "text-breaker/90"
                              : line.side === "B"
                                ? "text-fixer/90"
                                : "text-muted"
                      }
                    >
                      <span className="text-muted">{line.clock}</span> {line.text}
                      {line.kind === "tamper" && (
                        <span className="ml-1 inline-block border border-verdict/60 px-1 text-[10px] uppercase tracking-wider text-verdict">
                          tamper
                        </span>
                      )}
                    </div>
                    {line.diff && (
                      <pre className="mt-1 overflow-x-auto border border-verdict/40 bg-base p-2 text-[11px] text-verdict">
                        {line.diff.join("\n")}
                      </pre>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {phase === "over" && verdict && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="mt-4 border border-rule bg-panel p-4"
                >
                  <div
                    className={`font-mono text-sm font-semibold uppercase tracking-[0.14em] ${
                      verdict.includes("TAMPER") ? "text-verdict" : "text-ink"
                    }`}
                  >
                    {verdict.replace(/_/g, " ")}
                  </div>
                  <p className="mt-2 font-body text-sm text-muted">
                    {verdict.includes("TAMPER")
                      ? "Hidden suite never saw a real fix. Agent tampered."
                      : "Hidden suite green. Deterministic win — no LLM judge."}
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="pressable mt-4 border border-rule px-3 py-2 font-mono text-[11px] text-ink hover:border-muted"
                  >
                    run another
                  </button>
                </motion.div>
              )}
            </div>

            {phase === "fight" && (
              <div className="border-t border-rule px-3 py-2 font-mono text-[11px] text-muted">
                tip: as BREAKER, try{" "}
                {path === "cheat" ? (
                  <span className="text-verdict">run_tests after writing the test file</span>
                ) : (
                  <span className="text-fixer">write the source, then run_tests</span>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-rule bg-panel p-3 lg:border-l lg:border-t-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fixer">
              FIXER
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted">calls {calls.b}/40</p>
            <div className="mt-3 grid gap-1.5">
              {TOOLS.map((t) => (
                <button
                  key={`b-${t.id}`}
                  type="button"
                  disabled={phase !== "fight"}
                  onClick={() => fireTool(t.id, "B")}
                  className="pressable touch-target border border-rule px-2 py-2 text-left font-mono text-[11px] text-ink enabled:hover:border-fixer enabled:hover:text-fixer disabled:opacity-30"
                >
                  <span className="text-fixer">→</span> {t.label}
                  <span className="mt-0.5 block text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
