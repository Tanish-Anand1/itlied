"use client";

import { MatchReplay } from "@/components/match/MatchReplay";
import { demoBundle, isDemoMode } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/client";
import type { MatchEvent } from "@/lib/types";
import { useEffect, useState } from "react";

interface Bundle {
  matchId: string;
  fixtureId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  tokensA: number;
  tokensB: number;
  agentA: { id: string; name: string; elo: number; handle: string };
  agentB: { id: string; name: string; elo: number; handle: string };
  events: MatchEvent[];
}

export function RecentReplay() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      setBundle(demoBundle);
      return;
    }

    const supabase = createClient();
    (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "finished")
        .order("ended_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!match) {
        setBundle(demoBundle);
        return;
      }

      const [{ data: a }, { data: b }, { data: events }] = await Promise.all([
        supabase.from("agents_public").select("*, profiles(handle)").eq("id", match.agent_a).single(),
        supabase.from("agents_public").select("*, profiles(handle)").eq("id", match.agent_b).single(),
        supabase
          .from("match_events")
          .select("*")
          .eq("match_id", match.id)
          .order("seq", { ascending: true }),
      ]);

      let agentA = a;
      let agentB = b;
      if (!agentA || !agentB) {
        const fa = await supabase.from("agents").select("*").eq("id", match.agent_a).single();
        const fb = await supabase.from("agents").select("*").eq("id", match.agent_b).single();
        agentA = fa.data;
        agentB = fb.data;
      }

      const list = (events as MatchEvent[]) ?? [];
      if (!agentA || !agentB || list.length === 0) {
        setBundle(demoBundle);
        return;
      }

      const handleOf = (row: { name: string; profiles?: { handle?: string } | null }) =>
        row.profiles?.handle ?? row.name.toLowerCase().replace(/\s+/g, "_");

      setBundle({
        matchId: match.id,
        fixtureId: match.fixture_id,
        status: match.status,
        startedAt: match.started_at,
        endedAt: match.ended_at,
        tokensA: match.tokens_a,
        tokensB: match.tokens_b,
        agentA: {
          id: agentA.id,
          name: agentA.name,
          elo: agentA.elo,
          handle: handleOf(agentA as { name: string; profiles?: { handle?: string } }),
        },
        agentB: {
          id: agentB.id,
          name: agentB.name,
          elo: agentB.elo,
          handle: handleOf(agentB as { name: string; profiles?: { handle?: string } }),
        },
        events: list,
      });
    })().catch(() => setBundle(demoBundle));
  }, []);

  if (empty) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-sm text-muted">
        No finished matches yet. Submit a prompt above.
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-sm text-muted">
        loading replay
      </div>
    );
  }

  return (
    <MatchReplay
      matchId={bundle.matchId}
      fixtureId={bundle.fixtureId}
      status={bundle.status}
      startedAt={bundle.startedAt}
      endedAt={bundle.endedAt}
      tokensA={bundle.tokensA}
      tokensB={bundle.tokensB}
      agentA={bundle.agentA}
      agentB={bundle.agentB}
      initialEvents={bundle.events}
      mode="replay"
      speed={2}
      compact
      autoplay
    />
  );
}
