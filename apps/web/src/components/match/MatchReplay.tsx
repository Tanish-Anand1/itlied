"use client";

import { MATCH_LIMITS } from "@agentarena/shared";
import { AgentStream } from "@/components/match/AgentStream";
import { KillFeed } from "@/components/match/KillFeed";
import { VerdictCard, verdictFromEvents } from "@/components/match/VerdictCard";
import { createClient } from "@/lib/supabase/client";
import {
  countToolCalls,
  eventsUpTo,
  killFeedEvents,
  remainingClock,
  replayStepMs,
  type ReplayMode,
} from "@/lib/replay/engine";
import type { MatchEvent } from "@/lib/types";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export interface MatchReplayProps {
  matchId: string;
  fixtureId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  tokensA: number;
  tokensB: number;
  agentA: { id: string; name: string; elo: number; handle: string };
  agentB: { id: string; name: string; elo: number; handle: string };
  initialEvents: MatchEvent[];
  /** replay = scrubber + speed; live = subscribe + follow tip */
  mode?: ReplayMode;
  /** Default 2 for replay, 1 for live, 4 for landing teaser */
  speed?: number;
  compact?: boolean;
  autoplay?: boolean;
}

export function MatchReplay({
  matchId,
  fixtureId,
  status,
  startedAt,
  endedAt,
  tokensA,
  tokensB,
  agentA,
  agentB,
  initialEvents,
  mode: modeProp,
  speed: speedProp,
  compact = false,
  autoplay = true,
}: MatchReplayProps) {
  const reduceMotion = useReducedMotion();
  const mode: ReplayMode =
    modeProp ?? (status === "running" || status === "queued" ? "live" : "replay");
  const [speed, setSpeed] = useState(speedProp ?? (mode === "live" ? 1 : 3));
  const [events, setEvents] = useState<MatchEvent[]>(
    [...initialEvents].sort((a, b) => a.seq - b.seq),
  );
  // Start at first event so the feed is never a blank instrument on open
  const [cursor, setCursor] = useState(mode === "live" ? Math.max(0, events.length - 1) : 0);
  const [playing, setPlaying] = useState(autoplay && mode === "replay");
  const [now, setNow] = useState(Date.now());
  const [tamperFlash, setTamperFlash] = useState(false);
  const [highlightSeq, setHighlightSeq] = useState<number | null>(null);
  const cursorRef = useRef(cursor);
  const isDemo =
    matchId === "demo" ||
    matchId === "cccccccc-cccc-cccc-cccc-cccccccccccc";

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (mode !== "live") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as MatchEvent;
          setEvents((prev) => {
            if (prev.some((e) => e.seq === row.seq)) return prev;
            return [...prev, row].sort((a, b) => a.seq - b.seq);
          });
          setCursor((c) => Math.max(c, row.seq - 1));
          if (row.type === "tamper") {
            setTamperFlash(true);
            window.setTimeout(() => setTamperFlash(false), 700);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, mode]);

  useEffect(() => {
    if (mode === "live") setCursor(events.length - 1);
  }, [events.length, mode]);

  useEffect(() => {
    if (mode !== "replay" || !playing || events.length === 0) return;

    // Step one event at a time. Never skip the bout for reduced-motion —
    // only shorten the interval (CSS already drops transform motion).
    let idx = cursorRef.current;
    if (idx < 0 || idx >= events.length - 1) {
      idx = 0;
      cursorRef.current = 0;
      setCursor(0);
    }

    const step = replayStepMs(speed, Boolean(reduceMotion));
    const id = window.setInterval(() => {
      const next = cursorRef.current + 1;
      if (next >= events.length) {
        cursorRef.current = events.length - 1;
        setCursor(events.length - 1);
        setPlaying(false);
        return;
      }
      cursorRef.current = next;
      setCursor(next);
    }, step);

    return () => window.clearInterval(id);
  }, [mode, playing, speed, events.length, reduceMotion]);

  useEffect(() => {
    if (mode !== "live") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);

  const visible = useMemo(() => eventsUpTo(events, cursor), [events, cursor]);
  const feed = useMemo(() => killFeedEvents(visible), [visible]);
  const streamA = useMemo(
    () => visible.filter((e) => e.agent_id === agentA.id),
    [visible, agentA.id],
  );
  const streamB = useMemo(
    () => visible.filter((e) => e.agent_id === agentB.id),
    [visible, agentB.id],
  );

  const verdict = verdictFromEvents(visible);
  const shortId = matchId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const clockLabel =
    mode === "live"
      ? remainingClock(startedAt, now, MATCH_LIMITS.wallClockMs)
      : endedAt && startedAt
        ? formatDuration(new Date(endedAt).getTime() - new Date(startedAt).getTime())
        : "replay";

  const onScrub = (value: number) => {
    setPlaying(false);
    setCursor(value);
    cursorRef.current = value;
    setHighlightSeq(null);
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const atEnd = events.length === 0 || cursorRef.current >= events.length - 1;
    if (atEnd) {
      cursorRef.current = 0;
      setCursor(0);
    }
    setPlaying(true);
  };

  const jumpToDeciding = () => {
    if (!verdict?.decidingSeq) return;
    const idx = events.findIndex((e) => e.seq === verdict.decidingSeq);
    if (idx < 0) return;
    setPlaying(false);
    setCursor(idx);
    cursorRef.current = idx;
    setHighlightSeq(verdict.decidingSeq);
  };

  return (
    <div className={`flex h-full min-h-0 flex-col bg-base ${compact ? "" : "min-h-[calc(100dvh-2.75rem)]"}`}>
      {isDemo && !compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-breaker/30 bg-breaker/10 px-3 py-2 font-mono text-[11px] text-breaker">
          <span>seeded replay · BREAKER tampers · FIXER wins by default</span>
          <span className="text-muted">live agents need Supabase + OPENAI_API_KEY + runner</span>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-rule bg-panel/80 px-3 py-2 backdrop-blur-md md:px-4">
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-ink">
          <span className="text-breaker">&gt;_</span> match {shortId}
        </div>
        <div className="font-mono text-[11px] text-muted">fixture: {fixtureId}</div>
        <div className="font-mono text-[12px] text-ink" aria-live="polite">
          {mode === "live" && (
            <span className="live-dot mr-2 inline-block h-1.5 w-1.5 bg-breaker align-middle" />
          )}
          {playing && mode === "replay" && (
            <span className="live-dot mr-2 inline-block h-1.5 w-1.5 bg-fixer align-middle" />
          )}
          {clockLabel}
        </div>
      </header>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          compact
            ? "md:grid-cols-3"
            : "lg:grid-cols-[1fr_minmax(220px,28%)_1fr]"
        }`}
      >
        <div className="min-h-[200px] border-b border-rule lg:min-h-0 lg:border-b-0 lg:border-r">
          <AgentStream
            label="BREAKER"
            handle={agentA.handle}
            elo={agentA.elo}
            accent="breaker"
            events={streamA}
            tokens={tokensA}
            toolCalls={countToolCalls(visible, agentA.id)}
            showElo={Boolean(verdict) || status === "finished"}
          />
        </div>

        <div className="min-h-[240px] border-b border-rule lg:min-h-0 lg:border-b-0">
          <KillFeed
            events={feed}
            agentAId={agentA.id}
            agentBId={agentB.id}
            startedAt={startedAt}
            tamperFlash={tamperFlash}
            highlightSeq={highlightSeq}
          />
        </div>

        <div className="min-h-[200px] lg:min-h-0 lg:border-l lg:border-rule">
          <AgentStream
            label="FIXER"
            handle={agentB.handle}
            elo={agentB.elo}
            accent="fixer"
            events={streamB}
            tokens={tokensB}
            toolCalls={countToolCalls(visible, agentB.id)}
            showElo={Boolean(verdict) || status === "finished"}
          />
        </div>
      </div>

      {mode === "replay" && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-rule bg-base/70 px-3 py-2 font-mono text-[11px] text-muted backdrop-blur-xl backdrop-saturate-150">
          <button
            type="button"
            onClick={togglePlay}
            className="pressable touch-target border border-rule px-3 py-2 text-ink transition-[transform,background-color,border-color] duration-100 ease-out hover-border active:bg-panel-2"
          >
            {playing ? "pause" : cursor >= events.length - 1 ? "replay" : "play"}
          </button>
          <label className="flex items-center gap-2">
            speed
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="border border-rule bg-panel px-2 py-1.5 text-ink"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
              <option value={8}>8x</option>
            </select>
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, events.length - 1)}
            value={Math.max(0, cursor)}
            onChange={(e) => onScrub(Number(e.target.value))}
            onPointerDown={() => setPlaying(false)}
            className="min-w-[120px] flex-1 accent-fixer"
            aria-label="Replay scrubber"
          />
          <span className="tabular-nums">
            {Math.max(0, cursor + 1)}/{events.length}
          </span>
        </div>
      )}

      {verdict && !compact && (
        <div className="border-t border-rule bg-panel p-4 md:p-8">
          <VerdictCard
            matchId={matchId}
            nameA={agentA.name}
            nameB={agentB.name}
            handleA={agentA.handle}
            handleB={agentB.handle}
            verdict={verdict.verdict}
            decidingLine={verdict.decidingLine}
            durationLabel={formatDuration(verdict.durationMs)}
            winnerSide={
              verdict.winnerId === agentA.id
                ? "A"
                : verdict.winnerId === agentB.id
                  ? "B"
                  : null
            }
            onJumpToDeciding={verdict.decidingSeq != null ? jumpToDeciding : undefined}
          />
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
