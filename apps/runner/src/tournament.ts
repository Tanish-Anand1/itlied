/**
 * Single-elimination tournament advance: seed bracket, enqueue matches, promote winners.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { objectivesForFormat, type MatchFormat } from "@agentarena/shared";
import { config } from "./config.js";

const RUNNER_URL = `http://127.0.0.1:${config.port}`;

export async function advanceTournament(
  db: SupabaseClient,
  tournamentId: string,
): Promise<{ ok: boolean; action: string; detail?: unknown }> {
  const { data: t, error } = await db
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (error || !t) throw new Error("tournament not found");

  if (t.status === "open" || t.status === "seeding") {
    return seedBracket(db, t);
  }
  if (t.status === "active") {
    return promoteWinners(db, t);
  }
  return { ok: true, action: "noop", detail: { status: t.status } };
}

interface TourneyRow {
  id: string;
  season_id: string;
  fixture_id: string;
  model_id: string;
  format: MatchFormat;
  bracket_size: number;
  status: string;
}

async function seedBracket(
  db: SupabaseClient,
  t: TourneyRow,
): Promise<{ ok: boolean; action: string; detail?: unknown }> {
  const { data: entrants } = await db
    .from("tournament_entrants")
    .select("*")
    .eq("tournament_id", t.id)
    .order("created_at", { ascending: true });

  if (!entrants || entrants.length < 2) {
    return { ok: false, action: "seed", detail: "need at least 2 entrants" };
  }

  const size = t.bracket_size;
  const seeded = entrants.slice(0, size).map((e, i) => ({ ...e, seed: i + 1 }));
  for (const e of seeded) {
    await db.from("tournament_entrants").update({ seed: e.seed }).eq("id", e.id);
  }

  // Clear prior bracket rows for this tournament
  await db.from("tournament_matches").delete().eq("tournament_id", t.id);

  const rounds = Math.log2(size);
  // Round 1: pair 1vsSize, 2vsSize-1, …
  const round1Slots = size / 2;
  for (let slot = 0; slot < round1Slots; slot++) {
    const a = seeded[slot] ?? null;
    const b = seeded[size - 1 - slot] ?? null;
    await db.from("tournament_matches").insert({
      tournament_id: t.id,
      round: 1,
      slot,
      entrant_a: a?.id ?? null,
      entrant_b: b?.id ?? null,
    });
  }
  // Placeholder later rounds
  for (let round = 2; round <= rounds; round++) {
    const slots = size / 2 ** round;
    for (let slot = 0; slot < slots; slot++) {
      await db.from("tournament_matches").insert({
        tournament_id: t.id,
        round,
        slot,
        entrant_a: null,
        entrant_b: null,
      });
    }
  }

  await db.from("tournaments").update({ status: "active" }).eq("id", t.id);

  // Enqueue round 1 matches
  const { data: r1 } = await db
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", t.id)
    .eq("round", 1);

  let started = 0;
  for (const tm of r1 ?? []) {
    if (!tm.entrant_a || !tm.entrant_b) continue;
    const ok = await enqueueEdge(db, t, tm.id, tm.entrant_a, tm.entrant_b);
    if (ok) started += 1;
  }

  return { ok: true, action: "seeded", detail: { started, size } };
}

async function promoteWinners(
  db: SupabaseClient,
  t: TourneyRow,
): Promise<{ ok: boolean; action: string; detail?: unknown }> {
  const { data: tms } = await db
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", t.id)
    .order("round", { ascending: true })
    .order("slot", { ascending: true });

  if (!tms?.length) return { ok: false, action: "advance", detail: "no bracket" };

  let advanced = 0;
  for (const tm of tms) {
    if (tm.winner_entrant_id || !tm.match_id) continue;
    const { data: match } = await db
      .from("matches")
      .select("status, winner_id, agent_a, agent_b")
      .eq("id", tm.match_id)
      .maybeSingle();
    if (!match || match.status !== "finished" || !match.winner_id) continue;

    const { data: ea } = await db
      .from("tournament_entrants")
      .select("id, agent_id")
      .eq("id", tm.entrant_a)
      .maybeSingle();
    const { data: eb } = await db
      .from("tournament_entrants")
      .select("id, agent_id")
      .eq("id", tm.entrant_b)
      .maybeSingle();

    const winnerEntrant =
      ea && ea.agent_id === match.winner_id
        ? ea.id
        : eb && eb.agent_id === match.winner_id
          ? eb.id
          : null;
    if (!winnerEntrant) continue;

    const loser =
      ea && winnerEntrant === ea.id ? eb?.id ?? null : ea?.id ?? null;
    await db
      .from("tournament_matches")
      .update({ winner_entrant_id: winnerEntrant })
      .eq("id", tm.id);
    if (loser) {
      await db
        .from("tournament_entrants")
        .update({ eliminated: true })
        .eq("id", loser);
    }

    // Place winner into next round
    const nextRound = tm.round + 1;
    const nextSlot = Math.floor(tm.slot / 2);
    const { data: next } = await db
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", t.id)
      .eq("round", nextRound)
      .eq("slot", nextSlot)
      .maybeSingle();

    if (next) {
      const field = tm.slot % 2 === 0 ? "entrant_a" : "entrant_b";
      await db
        .from("tournament_matches")
        .update({ [field]: winnerEntrant })
        .eq("id", next.id);

      // If both sides filled and no match yet, enqueue
      const { data: refreshed } = await db
        .from("tournament_matches")
        .select("*")
        .eq("id", next.id)
        .single();
      if (
        refreshed?.entrant_a &&
        refreshed?.entrant_b &&
        !refreshed.match_id
      ) {
        await enqueueEdge(
          db,
          t,
          refreshed.id,
          refreshed.entrant_a,
          refreshed.entrant_b,
        );
      }
      advanced += 1;
    } else {
      // Final — champion
      await db.from("tournaments").update({ status: "completed" }).eq("id", t.id);
      return { ok: true, action: "champion", detail: { winnerEntrant } };
    }
  }

  return { ok: true, action: "advanced", detail: { advanced } };
}

async function enqueueEdge(
  db: SupabaseClient,
  t: TourneyRow,
  tournamentMatchId: string,
  entrantAId: string,
  entrantBId: string,
): Promise<boolean> {
  const { data: ea } = await db
    .from("tournament_entrants")
    .select("agent_id")
    .eq("id", entrantAId)
    .single();
  const { data: eb } = await db
    .from("tournament_entrants")
    .select("agent_id")
    .eq("id", entrantBId)
    .single();
  if (!ea || !eb) return false;

  const objectives = objectivesForFormat(t.format);
  const { data: match, error } = await db
    .from("matches")
    .insert({
      fixture_id: t.fixture_id,
      agent_a: ea.agent_id,
      agent_b: eb.agent_id,
      status: "queued",
      model_id: t.model_id,
      format: t.format,
      objective_a: objectives.objective_a,
      objective_b: objectives.objective_b,
      season_id: t.season_id,
    })
    .select("id")
    .single();
  if (error || !match) return false;

  await db
    .from("tournament_matches")
    .update({ match_id: match.id })
    .eq("id", tournamentMatchId);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.sharedSecret) headers["x-arena-secret"] = config.sharedSecret;
    await fetch(`${RUNNER_URL}/matches/${match.id}/start`, {
      method: "POST",
      headers,
    });
  } catch {
    /* queued — start may retry */
  }
  return true;
}
