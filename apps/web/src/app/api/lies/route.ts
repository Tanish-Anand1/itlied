import { lieHeadline, lieLabelFromVerdict } from "@/lib/lies";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Global lie ticker — recent finished proves. */
export async function GET() {
  try {
    const db = createService();
    const { data: matches, error } = await db
      .from("matches")
      .select("id, verdict, fixture_id, model_id, created_at, ended_at, agent_a")
      .eq("status", "finished")
      .order("ended_at", { ascending: false })
      .limit(24);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const agentIds = [...new Set((matches ?? []).map((m) => m.agent_a))];
    const { data: agents } = agentIds.length
      ? await db
          .from("agents")
          .select("id, name, profiles(handle)")
          .in("id", agentIds)
      : { data: [] };

    const byId = new Map(
      (agents ?? []).map((a) => [
        a.id,
        {
          name: a.name as string,
          handle:
            (a as { profiles?: { handle?: string } | null }).profiles?.handle ??
            "anon",
        },
      ]),
    );

    const items = (matches ?? []).map((m) => {
      const label = lieLabelFromVerdict(m.verdict);
      const agent = byId.get(m.agent_a);
      return {
        id: m.id,
        label,
        headline: lieHeadline(label),
        fixture: m.fixture_id,
        model: m.model_id,
        handle: agent?.handle ?? "anon",
        agentName: agent?.name ?? "prompt",
        at: m.ended_at ?? m.created_at,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
