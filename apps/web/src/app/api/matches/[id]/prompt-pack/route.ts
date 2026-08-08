import { DEMO_MATCH_ID } from "@/lib/demo/match";
import {
  buildDemoPromptPack,
  buildPromptPack,
  type PackFormat,
} from "@/lib/promptPack";
import { createClient, createService } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const FORMATS = new Set<PackFormat>(["raw", "cursor", "claude"]);

function packResponse(
  pack: ReturnType<typeof buildPromptPack>,
  format: PackFormat,
  download: boolean,
) {
  if (!pack.prompt.trim()) {
    return NextResponse.json({ error: "no_prompt" }, { status: 404 });
  }
  if (download) {
    const body = pack.exports[format];
    const filename =
      format === "cursor"
        ? "itlied-coding.mdc"
        : format === "claude"
          ? "CLAUDE.md"
          : `itlied-prompt.txt`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  return NextResponse.json({
    ...pack,
    format,
    text: pack.exports[format],
    howTo: pack.howToUse[format === "raw" ? "cursor" : format],
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "cursor") as PackFormat;
  const download = url.searchParams.get("download") === "1";
  if (!FORMATS.has(format)) {
    return NextResponse.json(
      { error: "invalid_format", formats: [...FORMATS] },
      { status: 400 },
    );
  }

  if (id === "demo" || id === DEMO_MATCH_ID) {
    return packResponse(buildDemoPromptPack(), format, download);
  }

  const userClient = await createClient();
  const { data: auth } = await userClient.auth.getUser();

  let db;
  try {
    db = createService();
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const { data: match, error: mErr } = await db
    .from("matches")
    .select("id, status, verdict, fixture_id, model_id, agent_a, agent_b")
    .eq("id", id)
    .maybeSingle();

  if (mErr || !match) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (match.status !== "finished" && match.status !== "cancelled") {
    return NextResponse.json(
      { error: "match_not_finished", status: match.status },
      { status: 409 },
    );
  }

  const [{ data: promptA }, { data: promptB }, { data: events }] =
    await Promise.all([
      db
        .from("agent_prompts")
        .select("system_prompt")
        .eq("agent_id", match.agent_a)
        .maybeSingle(),
      db
        .from("agent_prompts")
        .select("system_prompt")
        .eq("agent_id", match.agent_b)
        .maybeSingle(),
      db
        .from("match_events")
        .select("seq, type, agent_id, payload")
        .eq("match_id", id)
        .order("seq", { ascending: true }),
    ]);

  // Prefer the signed-in user's agent; else challenger (agent_a) — never house-as-yours.
  let preferAgentId: string = match.agent_a;
  if (auth.user) {
    const { data: owned } = await db
      .from("agents")
      .select("id")
      .eq("owner_id", auth.user.id)
      .in("id", [match.agent_a, match.agent_b]);
    const ownedIds = new Set((owned ?? []).map((a) => a.id));
    if (ownedIds.has(match.agent_a)) preferAgentId = match.agent_a;
    else if (ownedIds.has(match.agent_b)) preferAgentId = match.agent_b;
  }

  const pack = buildPromptPack({
    match,
    promptA: promptA?.system_prompt ?? null,
    promptB: promptB?.system_prompt ?? null,
    events: (events ?? []).map((e) => ({
      seq: e.seq,
      type: e.type,
      agent_id: e.agent_id,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    })),
    preferAgentId,
  });

  return packResponse(pack, format, download);
}
