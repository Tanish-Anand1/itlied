import { getProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL ?? "http://127.0.0.1:8080";
const RUNNER_SECRET = process.env.RUNNER_SHARED_SECRET ?? "";

export async function GET() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .order("starts_at", { ascending: false });
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*, seasons(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ seasons: seasons ?? [], tournaments: tournaments ?? [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as {
    action?: "create" | "register" | "advance" | "open";
    name?: string;
    season_id?: string;
    fixture_id?: string;
    model_id?: string;
    format?: string;
    bracket_size?: number;
    tournament_id?: string;
    agent_id?: string;
  };

  // Registration is open to any authenticated user
  if (body.action === "register" && body.tournament_id && body.agent_id) {
    const client = await createClient();
    const { data, error } = await client
      .from("tournament_entrants")
      .insert({
        tournament_id: body.tournament_id,
        profile_id: user.id,
        agent_id: body.agent_id,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entrant: data });
  }

  const profile = await getProfile();
  if (profile?.role !== "ops") {
    return NextResponse.json({ error: "ops_required" }, { status: 403 });
  }

  const svc = createService();

  if (body.action === "create") {
    const { data, error } = await svc
      .from("tournaments")
      .insert({
        name: body.name ?? "Tournament",
        season_id: body.season_id,
        fixture_id: body.fixture_id ?? "async-race",
        model_id: body.model_id ?? "fireworks/deepseek-v4-flash",
        format: body.format ?? "race_symmetric",
        bracket_size: body.bracket_size ?? 8,
        status: "draft",
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tournament: data });
  }

  if (body.action === "open" && body.tournament_id) {
    await svc
      .from("tournaments")
      .update({ status: "open" })
      .eq("id", body.tournament_id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "advance" && body.tournament_id) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (RUNNER_SECRET) headers["x-arena-secret"] = RUNNER_SECRET;
      const res = await fetch(`${RUNNER_URL}/tournaments/${body.tournament_id}/advance`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
