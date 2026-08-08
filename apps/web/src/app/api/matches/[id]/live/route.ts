import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight poll for Cinema Detect — status + events. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (isDemoMode() || id === "demo" || id === DEMO_MATCH_ID) {
    return NextResponse.json({
      id: DEMO_MATCH_ID,
      status: demoBundle.status,
      startedAt: demoBundle.startedAt,
      endedAt: demoBundle.endedAt,
      tokensA: demoBundle.tokensA,
      tokensB: demoBundle.tokensB,
      events: demoBundle.events,
    });
  }

  try {
    const db = createService();
    const { data: match, error } = await db
      .from("matches")
      .select("id, status, started_at, ended_at, tokens_a, tokens_b")
      .eq("id", id)
      .maybeSingle();
    if (error || !match) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const { data: events } = await db
      .from("match_events")
      .select("*")
      .eq("match_id", id)
      .order("seq", { ascending: true });

    return NextResponse.json({
      id: match.id,
      status: match.status,
      startedAt: match.started_at,
      endedAt: match.ended_at,
      tokensA: match.tokens_a ?? 0,
      tokensB: match.tokens_b ?? 0,
      events: events ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
