import {
  MODEL_PRICING,
  CEILING_COST_CENTS_PER_MATCH,
  type VerdictKind,
  assertModel,
  ceilingCostCentsForModel,
  estimateMatchCostCents,
  updateElo,
  updateEloDraw,
} from "@agentarena/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeMatchSpend, reserveMatchBudget } from "./budget.js";
import { fixturePath } from "./config.js";
import { EventLog } from "./events.js";
import { runAgent, type AgentRunResult } from "./agentLoop.js";

export interface StartMatchRequest {
  matchId: string;
}

export interface RunMatchOptions {
  /** Start route already reserved ceiling — do not reserve again. */
  alreadyReserved?: boolean;
  /** Ceiling used when alreadyReserved (must match start route). */
  reservedCents?: number;
}

export async function runMatch(
  db: SupabaseClient,
  matchId: string,
  opts: RunMatchOptions = {},
): Promise<void> {
  let holdingReserve = Boolean(opts.alreadyReserved);
  let reservedCents = opts.reservedCents ?? CEILING_COST_CENTS_PER_MATCH;

  if (!opts.alreadyReserved) {
    // Peek model for reserve size
    const { data: peek } = await db
      .from("matches")
      .select("model_id")
      .eq("id", matchId)
      .maybeSingle();
    try {
      if (peek?.model_id) {
        reservedCents = ceilingCostCentsForModel(assertModel(peek.model_id));
      }
    } catch {
      reservedCents = CEILING_COST_CENTS_PER_MATCH;
    }
    const budget = await reserveMatchBudget(db, reservedCents);
    if (!budget.allowed) {
      await db
        .from("matches")
        .update({ status: "budget_blocked", verdict: "BUDGET_KILL_SWITCH" })
        .eq("id", matchId);
      return;
    }
    holdingReserve = true;
  }

  try {
    const { data: match, error } = await db.from("matches").select("*").eq("id", matchId).single();
    if (error || !match) throw new Error(`Match not found: ${matchId}`);

    const agentA = await loadAgent(db, match.agent_a);
    const agentB = await loadAgent(db, match.agent_b);
    const costCents = await execute(db, match as MatchRow, agentA, agentB);
    if (holdingReserve) {
      await finalizeMatchSpend(db, costCents, reservedCents);
      holdingReserve = false;
    }
  } catch (err) {
    if (holdingReserve) {
      await finalizeMatchSpend(db, 0, reservedCents);
    }
    throw err;
  }
}

interface AgentRow {
  id: string;
  system_prompt: string;
  elo: number;
  name: string;
}

async function loadAgent(db: SupabaseClient, id: string): Promise<AgentRow> {
  const { data: agent, error } = await db.from("agents").select("*").eq("id", id).single();
  if (error || !agent) throw new Error(`Agent missing: ${id}`);
  const { data: prompt } = await db
    .from("agent_prompts")
    .select("system_prompt")
    .eq("agent_id", id)
    .single();
  if (!prompt?.system_prompt) throw new Error(`Prompt missing: ${id}`);
  return {
    id: agent.id,
    name: agent.name,
    elo: agent.elo,
    system_prompt: prompt.system_prompt,
  };
}

interface MatchRow {
  id: string;
  agent_a: string;
  agent_b: string;
  fixture_id: string;
  model_id?: string | null;
  format?: string | null;
  objective_a?: string | null;
  objective_b?: string | null;
}

async function execute(
  db: SupabaseClient,
  match: MatchRow,
  agentA: AgentRow,
  agentB: AgentRow,
): Promise<number> {
  const startedAt = new Date().toISOString();
  await db
    .from("matches")
    .update({ status: "running", started_at: startedAt })
    .eq("id", match.id);

  const fixtureRoot = fixturePath(match.fixture_id);
  const modelId = match.model_id ?? undefined;
  let pricing: { inputPerMillionUsd: number; outputPerMillionUsd: number } = {
    inputPerMillionUsd: MODEL_PRICING.inputPerMillionUsd,
    outputPerMillionUsd: MODEL_PRICING.outputPerMillionUsd,
  };
  if (modelId) {
    const m = assertModel(modelId);
    pricing = {
      inputPerMillionUsd: m.inputPerMillionUsd,
      outputPerMillionUsd: m.outputPerMillionUsd,
    };
  }

  const events = new EventLog(db, match.id);
  let decisive: AgentRunResult | null = null;
  const shouldAbort = () =>
    decisive !== null &&
    (decisive.verdict === "WIN_A" ||
      decisive.verdict === "WIN_B" ||
      decisive.verdict.startsWith("TAMPERED"));

  const markDecisive = (r: AgentRunResult) => {
    if (
      r.verdict === "WIN_A" ||
      r.verdict === "WIN_B" ||
      r.verdict.startsWith("TAMPERED")
    ) {
      if (!decisive) decisive = r;
    }
  };

  const [resultA, resultB] = await Promise.all([
    runAgent({
      matchId: match.id,
      agentId: agentA.id,
      side: "A",
      systemPrompt: agentA.system_prompt,
      objective: match.objective_a,
      fixtureRoot,
      modelId,
      events,
      shouldAbort,
      onDecisive: markDecisive,
    }).then((r) => {
      markDecisive(r);
      return r;
    }),
    runAgent({
      matchId: match.id,
      agentId: agentB.id,
      side: "B",
      systemPrompt: agentB.system_prompt,
      objective: match.objective_b,
      fixtureRoot,
      modelId,
      events,
      shouldAbort,
      onDecisive: markDecisive,
    }).then((r) => {
      markDecisive(r);
      return r;
    }),
  ]);

  const settled = settle(resultA, resultB, agentA.id, agentB.id);
  const costCents = estimateMatchCostCents(
    resultA.tokensIn,
    resultA.tokensOut,
    resultB.tokensIn,
    resultB.tokensOut,
    pricing.inputPerMillionUsd,
    pricing.outputPerMillionUsd,
  );

  await events.append(
    "verdict",
    {
      verdict: settled.verdict,
      winner_id: settled.winnerId,
      loser_id: settled.loserId,
      reason: settled.reason,
      deciding_line: settled.decidingLine,
      duration_ms: Math.max(resultA.durationMs, resultB.durationMs),
      tokens_a: resultA.tokensIn + resultA.tokensOut,
      tokens_b: resultB.tokensIn + resultB.tokensOut,
    },
    null,
  );

  await db
    .from("matches")
    .update({
      status: "finished",
      winner_id: settled.winnerId,
      verdict: settled.verdict,
      ended_at: new Date().toISOString(),
      tokens_a: resultA.tokensIn + resultA.tokensOut,
      tokens_b: resultB.tokensIn + resultB.tokensOut,
      cost_cents: costCents,
    })
    .eq("id", match.id);

  // Reveal prompts after match ends
  await db
    .from("agents")
    .update({ is_public: true })
    .in("id", [agentA.id, agentB.id]);

  if (settled.winnerId && settled.loserId) {
    const { error } = await db.rpc("apply_elo", {
      p_winner: settled.winnerId,
      p_loser: settled.loserId,
    });
    if (error) {
      if (settled.winnerId === agentA.id) {
        await bumpElo(db, agentA.id, true, agentA.elo, agentB.elo);
        await bumpElo(db, agentB.id, false, agentB.elo, agentA.elo);
      } else {
        await bumpElo(db, agentB.id, true, agentB.elo, agentA.elo);
        await bumpElo(db, agentA.id, false, agentA.elo, agentB.elo);
      }
    }
  } else if (settled.verdict === "DRAW" || settled.verdict === "TIMEOUT_BOTH") {
    const d = updateEloDraw(agentA.elo, agentB.elo);
    await db.from("agents").update({ elo: d.a }).eq("id", agentA.id);
    await db.from("agents").update({ elo: d.b }).eq("id", agentB.id);
  }

  return costCents;
}

async function bumpElo(
  db: SupabaseClient,
  id: string,
  won: boolean,
  selfElo: number,
  oppElo: number,
): Promise<void> {
  const next = won ? updateElo(selfElo, oppElo).winner : updateElo(oppElo, selfElo).loser;
  const { data } = await db.from("agents").select("wins, losses").eq("id", id).single();
  await db
    .from("agents")
    .update({
      elo: next,
      wins: (data?.wins ?? 0) + (won ? 1 : 0),
      losses: (data?.losses ?? 0) + (won ? 0 : 1),
    })
    .eq("id", id);
}

function settle(
  a: AgentRunResult,
  b: AgentRunResult,
  idA: string,
  idB: string,
): {
  verdict: VerdictKind;
  winnerId: string | null;
  loserId: string | null;
  reason: string;
  decidingLine: string;
} {
  // Tamper is an instant loss for that agent; other wins if they didn't also tamper
  if (a.verdict === "TAMPERED_A" && b.verdict !== "TAMPERED_B") {
    return {
      verdict: "TAMPERED_A",
      winnerId: idB,
      loserId: idA,
      reason: a.reason,
      decidingLine: a.decidingLine,
    };
  }
  if (b.verdict === "TAMPERED_B" && a.verdict !== "TAMPERED_A") {
    return {
      verdict: "TAMPERED_B",
      winnerId: idA,
      loserId: idB,
      reason: b.reason,
      decidingLine: b.decidingLine,
    };
  }
  if (a.verdict === "TAMPERED_A" && b.verdict === "TAMPERED_B") {
    return {
      verdict: "DRAW",
      winnerId: null,
      loserId: null,
      reason: "both tampered",
      decidingLine: "both deleted tests",
    };
  }

  if (a.verdict === "WIN_A" && b.verdict !== "WIN_B") {
    return {
      verdict: "WIN_A",
      winnerId: idA,
      loserId: idB,
      reason: a.reason,
      decidingLine: a.decidingLine,
    };
  }
  if (b.verdict === "WIN_B" && a.verdict !== "WIN_A") {
    return {
      verdict: "WIN_B",
      winnerId: idB,
      loserId: idA,
      reason: b.reason,
      decidingLine: b.decidingLine,
    };
  }
  if (a.verdict === "WIN_A" && b.verdict === "WIN_B") {
    // First by duration
    if (a.durationMs <= b.durationMs) {
      return {
        verdict: "WIN_A",
        winnerId: idA,
        loserId: idB,
        reason: "first to green",
        decidingLine: a.decidingLine,
      };
    }
    return {
      verdict: "WIN_B",
      winnerId: idB,
      loserId: idA,
      reason: "first to green",
      decidingLine: b.decidingLine,
    };
  }

  if (a.verdict.startsWith("TIMEOUT") && b.verdict.startsWith("TIMEOUT")) {
    const wallClock =
      a.decidingLine === "clock hits 0:00" && b.decidingLine === "clock hits 0:00";
    return {
      verdict: "TIMEOUT_BOTH",
      winnerId: null,
      loserId: null,
      reason:
        a.reason === b.reason ? a.reason : `${a.reason} · ${b.reason}`,
      decidingLine: wallClock
        ? "clock hits 0:00"
        : [a.decidingLine, b.decidingLine].filter(Boolean).join(" · "),
    };
  }
  if (a.verdict.startsWith("TIMEOUT")) {
    return {
      verdict: "TIMEOUT_A",
      winnerId: idB,
      loserId: idA,
      reason: a.reason,
      decidingLine: a.decidingLine,
    };
  }
  if (b.verdict.startsWith("TIMEOUT")) {
    return {
      verdict: "TIMEOUT_B",
      winnerId: idA,
      loserId: idB,
      reason: b.reason,
      decidingLine: b.decidingLine,
    };
  }

  if (a.verdict === "INCOMPLETE" && b.verdict === "INCOMPLETE") {
    return {
      verdict: "DRAW",
      winnerId: null,
      loserId: null,
      reason: a.reason === b.reason ? a.reason : `${a.reason} · ${b.reason}`,
      decidingLine: [a.decidingLine, b.decidingLine].filter(Boolean).join(" · ").slice(0, 200),
    };
  }

  return {
    verdict: "DRAW",
    winnerId: null,
    loserId: null,
    reason: "no decisive result",
    decidingLine: "stalemate",
  };
}
