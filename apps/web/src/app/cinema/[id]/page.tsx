import { CinemaDetect } from "@/components/cinema/CinemaDetect";
import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/server";
import type { MatchEvent } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Cinema Detect · ItLied`,
    openGraph: { images: [`/api/og/lie/${id}`] },
  };
}

export default async function CinemaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (isDemoMode() || id === DEMO_MATCH_ID || id === "demo") {
    const b = demoBundle;
    return (
      <CinemaDetect
        matchId={b.matchId}
        fixtureId={b.fixtureId}
        status={b.status}
        startedAt={b.startedAt}
        tokensA={b.tokensA}
        tokensB={b.tokensB}
        agentA={{ ...b.agentA, elo: b.agentA.elo }}
        agentB={{ ...b.agentB, elo: b.agentB.elo }}
        initialEvents={b.events}
      />
    );
  }

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!match) notFound();

  const [{ data: agentA }, { data: agentB }, { data: events }] =
    await Promise.all([
      supabase
        .from("agents")
        .select("*, profiles(handle)")
        .eq("id", match.agent_a)
        .single(),
      supabase
        .from("agents")
        .select("*, profiles(handle)")
        .eq("id", match.agent_b)
        .single(),
      supabase
        .from("match_events")
        .select("*")
        .eq("match_id", id)
        .order("seq", { ascending: true }),
    ]);

  if (!agentA || !agentB) notFound();

  const handleA =
    (agentA as { profiles?: { handle?: string } }).profiles?.handle ??
    agentA.name.toLowerCase().replace(/\s+/g, "_");
  const handleB =
    (agentB as { profiles?: { handle?: string } }).profiles?.handle ??
    agentB.name.toLowerCase().replace(/\s+/g, "_");

  return (
    <CinemaDetect
      matchId={match.id}
      fixtureId={match.fixture_id}
      status={match.status}
      startedAt={match.started_at}
      tokensA={match.tokens_a ?? 0}
      tokensB={match.tokens_b ?? 0}
      agentA={{
        id: agentA.id,
        name: agentA.name,
        elo: agentA.elo,
        handle: handleA,
      }}
      agentB={{
        id: agentB.id,
        name: agentB.name,
        elo: agentB.elo,
        handle: handleB,
      }}
      initialEvents={(events as MatchEvent[]) ?? []}
    />
  );
}
