import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL ?? "http://127.0.0.1:8080";
const RUNNER_SECRET = process.env.RUNNER_SHARED_SECRET ?? "";
const MAX_SPAN = 400;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as {
    match_id?: string;
    start_seq?: number;
    end_seq?: number;
  };
  const matchId = body.match_id;
  const start = Number(body.start_seq);
  const end = Number(body.end_seq);
  if (!matchId || !Number.isFinite(start) || !Number.isFinite(end)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (end < start || end - start > MAX_SPAN || start < 1) {
    return NextResponse.json({ error: "range" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, status, agent_a, agent_b")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.status !== "finished") {
    return NextResponse.json({ error: "match_not_ready" }, { status: 400 });
  }

  // Participants or ops
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, owner_id")
    .in("id", [match.agent_a, match.agent_b]);
  const isParticipant = (agents ?? []).some((a) => a.owner_id === user.id);
  if (!isParticipant && profile?.role !== "ops") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: clip, error } = await supabase
    .from("match_clips")
    .insert({
      match_id: matchId,
      created_by: user.id,
      start_seq: start,
      end_seq: end,
      status: "queued",
    })
    .select("*")
    .single();

  if (error || !clip) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (RUNNER_SECRET) headers["x-arena-secret"] = RUNNER_SECRET;
    await fetch(`${RUNNER_URL}/clips/${clip.id}/render`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* queued */
  }

  return NextResponse.json({ clip });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("match_id");
  const clipId = searchParams.get("id");
  const supabase = await createClient();

  if (clipId) {
    const { data } = await supabase
      .from("match_clips")
      .select("*")
      .eq("id", clipId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let url: string | null = null;
    if (data.storage_path && !String(data.storage_path).startsWith("local:")) {
      const svc = createService();
      const { data: signed } = await svc.storage
        .from("clips")
        .createSignedUrl(data.storage_path, 3600);
      url = signed?.signedUrl ?? null;
    }
    return NextResponse.json({ clip: data, url });
  }

  if (!matchId) return NextResponse.json({ error: "match_id" }, { status: 400 });
  const { data } = await supabase
    .from("match_clips")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ clips: data ?? [] });
}
