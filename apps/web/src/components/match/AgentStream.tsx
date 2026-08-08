"use client";

import type { MatchEvent } from "@/lib/types";
import { useEffect, useRef } from "react";

interface Props {
  label: "BREAKER" | "FIXER";
  handle: string;
  elo: number;
  accent: "breaker" | "fixer";
  events: MatchEvent[];
  tokens: number;
  toolCalls: number;
  toolLimit?: number;
  /** Elo is ladder noise during the fight — show only post-verdict. */
  showElo?: boolean;
}

export function AgentStream({
  label,
  handle,
  elo,
  accent,
  events,
  tokens,
  toolCalls,
  toolLimit = 40,
  showElo = false,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const accentClass = accent === "breaker" ? "text-breaker" : "text-fixer";
  const barClass = accent === "breaker" ? "bg-breaker" : "bg-fixer";

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Pin tip inside this column only — never scroll the page.
    scroller.scrollTop = scroller.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <div className="border-b border-rule bg-panel px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px]">
          <span className={`font-semibold uppercase tracking-[0.14em] ${accentClass}`}>
            {label}
          </span>
          <span className="text-muted">|</span>
          <span className="truncate text-ink">@{handle}</span>
          <span className="text-muted">|</span>
          {showElo ? (
            <span className="shrink-0 text-muted" title="Elo rating">
              elo {elo}
            </span>
          ) : (
            <span className="shrink-0 text-muted">status: live</span>
          )}
        </div>
        <div className={`pm-bar mt-2`}>
          <span className={`${barClass} w-full opacity-70`} />
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-5 text-muted"
      >
        {events.length === 0 ? (
          <p className="text-muted">no tool calls yet</p>
        ) : (
          events.map((e) => (
            <div key={e.id || e.seq} className="stream-line">
              <StreamLine event={e} accent={accent} />
            </div>
          ))
        )}
      </div>

      <div className="border-t border-rule px-3 py-2 font-mono text-[11px] text-muted">
        <div className="flex justify-between gap-2">
          <span>tokens {(tokens / 1000).toFixed(1)}k</span>
          <span>
            calls {toolCalls}/{toolLimit}
          </span>
        </div>
      </div>
    </div>
  );
}

function StreamLine({
  event,
  accent,
}: {
  event: MatchEvent;
  accent: "breaker" | "fixer";
}) {
  const color = accent === "breaker" ? "text-breaker" : "text-fixer";
  const p = event.payload;

  if (event.type === "thought") {
    return <p className="mb-1 text-ink/80">··· {String(p.text ?? "").slice(0, 160)}</p>;
  }
  if (event.type === "tool_call") {
    const tool = String(p.tool);
    const args = p.args as Record<string, unknown>;
    let detail = "";
    if (tool === "read_file" || tool === "write_file") detail = String(args.path ?? "");
    if (tool === "run_shell") detail = String(args.cmd ?? "").slice(0, 48);
    if (tool === "run_tests") detail = "visible";
    return (
      <p className={`mb-1 ${color}`}>
        → {tool} {detail}
      </p>
    );
  }
  if (event.type === "tool_result") {
    const ok = Boolean(p.ok);
    return (
      <p className={`mb-1 ${ok ? "text-muted" : "text-breaker"}`}>
        ← {ok ? "ok" : "fail"} {String(p.output ?? "").slice(0, 80)}
      </p>
    );
  }
  if (event.type === "test_run") {
    return (
      <p className="mb-1 text-ink">
        test {Number(p.passed)}pass {Number(p.failed)}fail
      </p>
    );
  }
  if (event.type === "tamper") {
    return (
      <p className="mb-1 text-verdict">
        <span className="mr-1 inline-block border border-verdict/60 px-1 text-[10px] uppercase tracking-wider">
          tamper
        </span>
        {String(p.reason ?? "")}
      </p>
    );
  }
  return null;
}
