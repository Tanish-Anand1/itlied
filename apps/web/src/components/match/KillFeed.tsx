"use client";

import { killFeedLine } from "@agentarena/shared";
import { formatMatchClock } from "@/lib/replay/engine";
import type { MatchEvent } from "@/lib/types";
import { useEffect, useRef } from "react";

interface Props {
  events: MatchEvent[];
  agentAId: string;
  agentBId: string;
  startedAt: string | null;
  tamperFlash: boolean;
  highlightSeq?: number | null;
}

export function KillFeed({
  events,
  agentAId,
  agentBId,
  startedAt,
  tamperFlash,
  highlightSeq = null,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // Stay inside this panel — never scrollIntoView (that yanks the page).
    if (highlightSeq != null && highlightRef.current) {
      const row = highlightRef.current;
      const top =
        row.offsetTop - scroller.clientHeight / 2 + row.clientHeight / 2;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }

    scroller.scrollTop = scroller.scrollHeight;
  }, [events.length, highlightSeq]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col border-x border-rule bg-panel ${
        tamperFlash ? "kill-feed-tamper" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          kill_feed <span className="text-muted/60">|</span> {events.length} events
        </h2>
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-5"
      >
        {events.length === 0 && (
          <p className="text-muted">
            <span className="text-breaker">|</span> waiting for first tool call
          </p>
        )}
        {events.map((e, i) => {
          const side =
            e.agent_id === agentAId ? "A" : e.agent_id === agentBId ? "B" : null;
          const line = killFeedLine(e.type, e.payload, side);
          const clock = formatMatchClock(startedAt, e.ts);
          const isTamper = e.type === "tamper";
          const isVerdict = e.type === "verdict";
          const isHighlight = highlightSeq != null && e.seq === highlightSeq;

          return (
            <div
              key={e.id || `${e.seq}`}
              ref={isHighlight ? highlightRef : undefined}
              className={`kill-feed-row mb-2 ${
                i === events.length - 1 ? "kill-feed-row--tip" : ""
              } ${isHighlight ? "border border-fixer/50 bg-fixer/5 px-2 py-1" : ""}`}
            >
              <div
                className={
                  isTamper
                    ? "text-verdict"
                    : isVerdict
                      ? "text-ink"
                      : side === "A"
                        ? "text-breaker/90"
                        : side === "B"
                          ? "text-fixer/90"
                          : "text-muted"
                }
              >
                <span className="text-muted">{clock}</span>{" "}
                {isTamper && (
                  <span className="mr-1 inline-block border border-verdict/60 px-1 text-[10px] uppercase tracking-wider text-verdict">
                    tamper
                  </span>
                )}
                <span>{line}</span>
              </div>
              {isTamper && Array.isArray(e.payload.diff_lines) && (
                <pre className="mt-1 overflow-x-auto border border-verdict/40 bg-base/80 p-2 text-[11px] text-verdict">
                  {(e.payload.diff_lines as string[]).slice(0, 12).join("\n")}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
