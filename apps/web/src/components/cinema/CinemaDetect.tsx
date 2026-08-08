"use client";

import { AgentStream } from "@/components/match/AgentStream";
import { KillFeed } from "@/components/match/KillFeed";
import { verdictFromEvents } from "@/components/match/VerdictCard";
import { DEMO_MATCH_ID } from "@/lib/demo/match";
import { lieHeadline, lieLabelFromVerdict, lieSubcopy } from "@/lib/lies";
import {
  countToolCalls,
  killFeedEvents,
  remainingClock,
} from "@/lib/replay/engine";
import { createClient } from "@/lib/supabase/client";
import { MATCH_LIMITS } from "@agentarena/shared";
import type { MatchEvent } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export interface CinemaDetectProps {
  matchId: string;
  fixtureId: string;
  status: string;
  startedAt: string | null;
  tokensA: number;
  tokensB: number;
  agentA: { id: string; name: string; elo: number; handle: string };
  agentB: { id: string; name: string; elo: number; handle: string };
  initialEvents: MatchEvent[];
}

function isDemoId(id: string) {
  return id === "demo" || id === DEMO_MATCH_ID;
}

/** Full-bleed prove — seamless live → slam → share. */
export function CinemaDetect({
  matchId,
  fixtureId,
  status: initialStatus,
  startedAt: initialStartedAt,
  tokensA: initialTokensA,
  tokensB: initialTokensB,
  agentA,
  agentB,
  initialEvents,
}: CinemaDetectProps) {
  const demoReplay = isDemoId(matchId) && initialEvents.length > 0;
  const [events, setEvents] = useState<MatchEvent[]>(() =>
    demoReplay ? [] : [...initialEvents].sort((a, b) => a.seq - b.seq),
  );
  const [status, setStatus] = useState(() =>
    demoReplay ? "running" : initialStatus,
  );
  const [startedAt, setStartedAt] = useState<string | null>(() =>
    demoReplay ? new Date().toISOString() : initialStartedAt,
  );
  const [tokensA, setTokensA] = useState(initialTokensA);
  const [tokensB, setTokensB] = useState(initialTokensB);
  const [now, setNow] = useState(Date.now());
  const [slam, setSlam] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tamperFlash, setTamperFlash] = useState(false);

  const live = status === "running" || status === "queued";
  const publicId = isDemoId(matchId) ? "demo" : matchId;
  const lieHref = `/lie/${publicId}`;
  const matchHref = `/match/${publicId}`;
  const packHref = `/match/${publicId}#verdict-card`;

  const mergeEvents = (incoming: MatchEvent[]) => {
    setEvents((prev) => {
      const map = new Map<number, MatchEvent>();
      for (const e of prev) map.set(e.seq, e);
      for (const e of incoming) map.set(e.seq, e);
      return [...map.values()].sort((a, b) => a.seq - b.seq);
    });
  };

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  // Demo: stream seeded events so Cinema feels live before the slam
  useEffect(() => {
    if (!demoReplay) return;
    const sorted = [...initialEvents].sort((a, b) => a.seq - b.seq);
    const t0 = sorted[0] ? Date.parse(sorted[0].ts) : Date.now();
    const timers: number[] = [];
    for (const ev of sorted) {
      const delay = Math.max(0, (Date.parse(ev.ts) - t0) / 2.2);
      timers.push(
        window.setTimeout(() => {
          mergeEvents([ev]);
          if (ev.type === "tamper") {
            setTamperFlash(true);
            window.setTimeout(() => setTamperFlash(false), 700);
          }
          if (ev.type === "verdict") {
            setStatus("finished");
          }
        }, delay),
      );
    }
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoReplay, matchId]);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/matches/${publicId}/live`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        status?: string;
        startedAt?: string | null;
        tokensA?: number;
        tokensB?: number;
        events?: MatchEvent[];
      };
      if (data.status) setStatus(data.status);
      if (data.startedAt !== undefined) setStartedAt(data.startedAt);
      if (typeof data.tokensA === "number") setTokensA(data.tokensA);
      if (typeof data.tokensB === "number") setTokensB(data.tokensB);
      if (data.events?.length) mergeEvents(data.events);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (demoReplay || isDemoId(matchId)) return;
    if (!live) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`cinema:${matchId}`)
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
          mergeEvents([row]);
          if (row.type === "tamper") {
            setTamperFlash(true);
            window.setTimeout(() => setTamperFlash(false), 700);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as {
            status?: string;
            started_at?: string | null;
            tokens_a?: number;
            tokens_b?: number;
          };
          if (row.status) setStatus(row.status);
          if (row.started_at !== undefined) setStartedAt(row.started_at);
          if (typeof row.tokens_a === "number") setTokensA(row.tokens_a);
          if (typeof row.tokens_b === "number") setTokensB(row.tokens_b);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [matchId, live, demoReplay]);

  // Reliable poll — works even when Realtime flaps
  useEffect(() => {
    if (demoReplay) return;
    void refresh();
    const ms = live ? 2500 : 0;
    if (!ms) return;
    const id = window.setInterval(() => void refresh(), ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, publicId, demoReplay]);

  const feed = useMemo(() => killFeedEvents(events), [events]);
  const streamA = useMemo(
    () => events.filter((e) => e.agent_id === agentA.id),
    [events, agentA.id],
  );
  const streamB = useMemo(
    () => events.filter((e) => e.agent_id === agentB.id),
    [events, agentB.id],
  );
  const clock = startedAt
    ? remainingClock(startedAt, now, MATCH_LIMITS.wallClockMs)
    : live
      ? "…"
      : "00:00";
  const verdict = verdictFromEvents(events);
  const finished = Boolean(verdict) || status === "finished" || status === "cancelled";

  useEffect(() => {
    if (!finished || !verdict) return;
    const delay = demoReplay ? 900 : 400;
    const t = window.setTimeout(() => setSlam(true), delay);
    return () => window.clearTimeout(t);
  }, [finished, verdict, demoReplay]);

  const label = lieLabelFromVerdict(verdict?.verdict);
  const headline = lieHeadline(label);
  const accent =
    label === "CLEARED"
      ? "text-fixer"
      : label === "IT_LIED" || label === "TAMPER"
        ? "text-verdict"
        : "text-breaker";

  const share = async () => {
    const url = `${window.location.origin}${lieHref}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-base text-ink">
      <header className="flex items-center justify-between border-b border-rule px-4 py-3 font-mono text-[11px]">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-ink">
            esc
          </Link>
          <span className="uppercase tracking-[0.18em] text-breaker">
            cinema detect
          </span>
          <span className="text-muted">{fixtureId}</span>
          {live && (
            <span className="text-muted">
              {status === "queued" ? "queued" : "racing"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {live && (
            <span className="flex items-center gap-2 text-breaker">
              <span className="live-dot inline-block h-2 w-2 bg-breaker" />
              live
            </span>
          )}
          <span className="text-2xl tabular-nums tracking-[0.12em] text-ink md:text-4xl">
            {clock}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto_1fr] lg:grid-cols-[1fr_minmax(240px,0.85fr)_1fr] lg:grid-rows-1">
        <div className="min-h-[200px] border-b border-rule lg:min-h-0 lg:border-b-0 lg:border-r">
          <AgentStream
            label="BREAKER"
            handle={agentA.handle}
            elo={agentA.elo}
            accent="breaker"
            events={streamA}
            tokens={tokensA}
            toolCalls={countToolCalls(events, agentA.id)}
            showElo={finished}
          />
        </div>
        <div className="max-h-[30vh] border-b border-rule lg:max-h-none lg:border-b-0 lg:border-r">
          <KillFeed
            events={feed}
            agentAId={agentA.id}
            agentBId={agentB.id}
            startedAt={startedAt}
            tamperFlash={tamperFlash}
          />
        </div>
        <div className="min-h-[200px] lg:min-h-0">
          <AgentStream
            label="FIXER"
            handle={agentB.handle}
            elo={agentB.elo}
            accent="fixer"
            events={streamB}
            tokens={tokensB}
            toolCalls={countToolCalls(events, agentB.id)}
            showElo={finished}
          />
        </div>
      </div>

      {!slam && finished && !verdict && (
        <div className="border-t border-rule px-4 py-3 text-center font-mono text-[12px] text-muted">
          settling verdict…
        </div>
      )}

      {slam && verdict && (
        <div className="cinema-slam absolute inset-0 z-50 flex flex-col items-center justify-center bg-base/95 px-6 text-center backdrop-blur-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            final call · hidden suite
          </p>
          <h1
            className={`cinema-slam-title mt-4 font-display text-[clamp(4rem,18vw,9rem)] leading-[0.82] tracking-[-0.05em] ${accent}`}
          >
            {headline}
          </h1>
          <p className="mt-6 max-w-lg font-body text-lg text-muted">
            {lieSubcopy(label)}
          </p>
          {verdict.decidingLine && (
            <p className="mt-3 font-mono text-[12px] text-ink">
              {verdict.decidingLine}
            </p>
          )}
          <div className="mt-10 flex flex-wrap justify-center gap-3 font-mono text-[12px]">
            <button
              type="button"
              onClick={() => void share()}
              className="pressable border border-verdict/50 bg-verdict/15 px-5 py-3 uppercase tracking-[0.16em] text-verdict"
            >
              {copied ? "link copied" : "copy lie card link"}
            </button>
            <Link
              href={lieHref}
              className="pressable border border-breaker/50 bg-breaker/10 px-5 py-3 uppercase tracking-[0.16em] text-breaker"
            >
              open card →
            </Link>
            <Link
              href={packHref}
              className="pressable border border-rule px-5 py-3 uppercase tracking-[0.16em] text-ink"
            >
              export pack
            </Link>
            <Link
              href="/#play"
              className="pressable border border-rule px-5 py-3 uppercase tracking-[0.16em] text-muted"
            >
              detect again
            </Link>
            <Link
              href={matchHref}
              className="pressable text-[11px] text-muted hover:text-ink"
            >
              classic replay
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
