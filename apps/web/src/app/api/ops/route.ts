import { getProfile, getSessionUser } from "@/lib/auth";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || profile?.role !== "ops") {
    return NextResponse.json({ error: "ops_required" }, { status: 403 });
  }

  const db = createService();
  const day = new Date().toISOString().slice(0, 10);
  const { data: spend } = await db
    .from("daily_spend")
    .select("*")
    .eq("day", day)
    .maybeSingle();

  const { count: matchCount } = await db
    .from("matches")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${day}T00:00:00Z`);

  const { data: fixtures } = await db.from("fixtures").select("id, name, difficulty");
  const { data: seasons } = await db
    .from("seasons")
    .select("*")
    .eq("active", true);

  return NextResponse.json({
    spend: spend ?? { day, spend_cents: 0, reserved_cents: 0, kill_switch: false },
    matches_today: matchCount ?? 0,
    fixtures: fixtures ?? [],
    seasons: seasons ?? [],
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || profile?.role !== "ops") {
    return NextResponse.json({ error: "ops_required" }, { status: 403 });
  }

  const body = (await req.json()) as { kill_switch?: boolean };
  const db = createService();
  const day = new Date().toISOString().slice(0, 10);
  await db.from("daily_spend").upsert(
    { day, kill_switch: Boolean(body.kill_switch) },
    { onConflict: "day" },
  );
  return NextResponse.json({ ok: true, kill_switch: Boolean(body.kill_switch) });
}
