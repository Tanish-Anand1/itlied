import { MatchReplay } from "@/components/match/MatchReplay";
import { MatchComments } from "@/components/match/MatchComments";
import { ClipExport } from "@/components/match/ClipExport";
import { Wordmark } from "@/components/brand/Wordmark";
import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/server";
import type { MatchEvent } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const short = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return {
    title: `Match ${short} · ItLied`,
    openGraph: {
      title: `Match ${short} · ItLied`,
      images: [`/api/og/match/${id}`],
    },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (isDemoMode() || id === DEMO_MATCH_ID || id === "demo") {
    const b = demoBundle;
    return (
      <MatchShell matchId="demo">
        <MatchReplay
          matchId={b.matchId}
          fixtureId={b.fixtureId}
          status={b.status}
          startedAt={b.startedAt}
          endedAt={b.endedAt}
          tokensA={b.tokensA}
          tokensB={b.tokensB}
          agentA={b.agentA}
          agentB={b.agentB}
          initialEvents={b.events}
          mode="replay"
          speed={2}
          autoplay
        />
      </MatchShell>
    );
  }

  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) notFound();

  const [{ data: agentA }, { data: agentB }, { data: events }] = await Promise.all([
    supabase.from("agents").select("*, profiles(handle)").eq("id", match.agent_a).single(),
    supabase.from("agents").select("*, profiles(handle)").eq("id", match.agent_b).single(),
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
    <MatchShell matchId={match.id}>
      <MatchReplay
        matchId={match.id}
        fixtureId={match.fixture_id}
        status={match.status}
        startedAt={match.started_at}
        endedAt={match.ended_at}
        tokensA={match.tokens_a}
        tokensB={match.tokens_b}
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
      {match.status === "finished" && (
        <>
          <MatchComments matchId={match.id} />
          <ClipExport matchId={match.id} />
        </>
      )}
    </MatchShell>
  );
}

function MatchShell({
  children,
  matchId,
}: {
  children: React.ReactNode;
  matchId: string;
}) {
  const cinemaId =
    matchId === "demo" || matchId === DEMO_MATCH_ID ? "demo" : matchId;
  return (
    <main className="relative z-[1] flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between border-b border-rule bg-base/70 px-3 py-2 backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="pressable shrink-0 hover:opacity-90">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
          <Link
            href={`/cinema/${cinemaId}`}
            className="text-breaker hover:text-ink"
          >
            cinema
          </Link>
          <Link href="/#play" className="hover:text-ink">
            detect
          </Link>
          <Link href="/ladder" className="hover:text-ink">
            ladder
          </Link>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </main>
  );
}
