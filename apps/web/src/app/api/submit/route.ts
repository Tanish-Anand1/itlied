import {
  DEFAULT_MODEL_ID,
  FIXTURE_ID_V1,
  assertFixture,
  assertModel,
  ceilingCostCentsForModel,
  objectivesForFormat,
  type MatchFormat,
} from "@agentarena/shared";
import { isDemoMode, supabaseReachable } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/server";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL ?? "http://127.0.0.1:8080";
const RUNNER_SECRET = process.env.RUNNER_SHARED_SECRET ?? "";

const submitHits = new Map<string, number[]>();
const SUBMIT_WINDOW_MS = 60 * 60 * 1000;
const SUBMIT_MAX = Number(process.env.SUBMIT_RATE_LIMIT_PER_HOUR ?? 20);

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const prev = (submitHits.get(key) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (prev.length >= SUBMIT_MAX) {
    submitHits.set(key, prev);
    return true;
  }
  prev.push(now);
  submitHits.set(key, prev);
  return false;
}

function demoResponse(reason?: string) {
  return NextResponse.json({
    matchId: "demo",
    demo: true,
    ...(reason ? { message: reason } : {}),
  });
}

/**
 * Authenticated submit: prompt + fixture + model + format → match → runner start.
 * Guests get demo fallback only.
 */
export async function POST(req: Request) {
  if (rateLimited(clientKey(req))) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many submits this hour." },
      { status: 429 },
    );
  }

  const body = (await req.json()) as {
    system_prompt?: string;
    fixture_id?: string;
    model_id?: string;
    format?: MatchFormat;
  };
  const prompt = (body.system_prompt ?? "").trim();
  if (prompt.length < 20) {
    return NextResponse.json({ error: "Prompt too short" }, { status: 400 });
  }
  if (prompt.length > 20_000) {
    return NextResponse.json({ error: "Prompt too long" }, { status: 400 });
  }

  let fixtureId = body.fixture_id ?? FIXTURE_ID_V1;
  let modelId = body.model_id ?? DEFAULT_MODEL_ID;
  const format: MatchFormat =
    body.format === "race_asymmetric" ? "race_asymmetric" : "race_symmetric";

  try {
    assertFixture(fixtureId);
  } catch {
    return NextResponse.json({ error: "invalid_fixture" }, { status: 400 });
  }
  let model;
  try {
    model = assertModel(modelId);
  } catch {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }

  if (isDemoMode()) {
    return demoResponse();
  }

  const userClient = await createClient();
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) {
    // Traction path: guests always get Cinema demo instead of a hard wall
    return demoResponse(
      "Demo cinema — sign in to run a live prove against the house.",
    );
  }

  const reachable = await supabaseReachable();
  if (!reachable) {
    return demoResponse(
      "Supabase unreachable — opened seeded demo match. Start local Supabase for live agents.",
    );
  }

  const db = createService();
  const ownerId = auth.user.id;

  // Ensure profile exists (trigger may lag)
  let { data: profile } = await db
    .from("profiles")
    .select("id, handle")
    .eq("id", ownerId)
    .maybeSingle();
  if (!profile) {
    const handleBase =
      (auth.user.email?.split("@")[0] ?? "user")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 24) || "user";
    await db.from("profiles").upsert({
      id: ownerId,
      handle: `${handleBase}_${ownerId.slice(0, 4)}`,
      email: auth.user.email,
    });
    const again = await db
      .from("profiles")
      .select("id, handle")
      .eq("id", ownerId)
      .maybeSingle();
    profile = again.data;
  }

  try {
    const budgetRes = await fetch(`${RUNNER_URL}/budget`, {
      signal: AbortSignal.timeout(2500),
    });
    if (budgetRes.ok) {
      const budget = (await budgetRes.json()) as { allowed?: boolean };
      if (budget.allowed === false) {
        return NextResponse.json(
          { error: "daily_budget_exceeded", budget_blocked: true },
          { status: 402 },
        );
      }
    }
  } catch {
    /* continue */
  }

  try {
    const { data: spend } = await db
      .from("daily_spend")
      .select("kill_switch")
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle();
    if (spend?.kill_switch) {
      return NextResponse.json(
        { error: "daily_budget_exceeded", budget_blocked: true },
        { status: 402 },
      );
    }
  } catch {
    return demoResponse("Database error — opened seeded demo match.");
  }

  const handle = profile?.handle ?? "challenger";
  const { data: challenger, error: cErr } = await db
    .from("agents")
    .insert({
      owner_id: ownerId,
      name: `Prompt ${handle}`,
      is_public: false,
    })
    .select("*")
    .single();
  if (cErr || !challenger) {
    return NextResponse.json(
      { error: cErr?.message ?? "agent create failed" },
      { status: 500 },
    );
  }

  const { error: pErr } = await db.from("agent_prompts").insert({
    agent_id: challenger.id,
    system_prompt: prompt,
  });
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // House FIXER — ops-owned baseline, created under challenger owner if none exist
  let opponentId: string;
  const { data: top } = await db
    .from("agents")
    .select("id")
    .neq("id", challenger.id)
    .eq("is_public", true)
    .order("elo", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (top) {
    opponentId = top.id;
  } else {
    const { data: houseAgent, error: hErr } = await db
      .from("agents")
      .insert({
        owner_id: ownerId,
        name: "House Baseline",
        is_public: true,
      })
      .select("id")
      .single();
    if (hErr || !houseAgent) {
      return NextResponse.json({ error: "opponent create failed" }, { status: 500 });
    }
    await db.from("agent_prompts").insert({
      agent_id: houseAgent.id,
      system_prompt:
        "You are a careful coding agent. Read files, find the bug, fix it with the smallest change. Never edit test files. Run tests. Reply DONE when green.",
    });
    opponentId = houseAgent.id;
  }

  const objectives = objectivesForFormat(format);
  const { data: season } = await db
    .from("seasons")
    .select("id")
    .eq("active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: match, error: mErr } = await db
    .from("matches")
    .insert({
      fixture_id: fixtureId,
      agent_a: challenger.id,
      agent_b: opponentId,
      status: "queued",
      model_id: modelId,
      format,
      objective_a: objectives.objective_a,
      objective_b: objectives.objective_b,
      season_id: season?.id ?? null,
    })
    .select("*")
    .single();

  if (mErr || !match) {
    return NextResponse.json(
      { error: mErr?.message ?? "match create failed" },
      { status: 500 },
    );
  }

  void ceilingCostCentsForModel(model);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (RUNNER_SECRET) headers["x-arena-secret"] = RUNNER_SECRET;
    const startRes = await fetch(`${RUNNER_URL}/matches/${match.id}/start`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!startRes.ok && startRes.status !== 202) {
      const bodyText = await startRes.text();
      console.error("[submit] runner start failed", startRes.status, bodyText.slice(0, 300));
      if (startRes.status === 402) {
        return NextResponse.json(
          { error: "daily_budget_exceeded", budget_blocked: true, matchId: match.id },
          { status: 402 },
        );
      }
      // No production runner yet — keep the loop alive with Cinema demo
      return demoResponse(
        "Live runner offline — playing demo cinema. Deploy apps/runner for live proves.",
      );
    }
  } catch {
    return demoResponse(
      "Live runner offline — playing demo cinema. Deploy apps/runner for live proves.",
    );
  }

  return NextResponse.json({ matchId: match.id });
}
