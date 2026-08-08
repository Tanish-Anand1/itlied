/**
 * Agent Arena match runner — long-lived Node service (Render/Railway).
 * Not Vercel serverless.
 */
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  CEILING_COST_CENTS_PER_MATCH,
  DAILY_BUDGET_CENTS,
  MATCH_LIMITS,
  MODEL_PRICING,
  assertModel,
  ceilingCostCentsForModel,
} from "@agentarena/shared";
import { getBudgetStatus, reserveMatchBudget } from "./budget.js";
import { config } from "./config.js";
import { runMatch } from "./match.js";
import { processClipJobs } from "./clips.js";
import { advanceTournament } from "./tournament.js";
import { providerStatus } from "./providers.js";

function requireEnv(): void {
  if (config.dryRun) return;
  const missing = [
    ["SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceKey],
  ].filter(([, v]) => !v);
  if (missing.length) {
    console.warn(
      `[runner] missing env: ${missing.map(([k]) => k).join(", ")} — API will error until set`,
    );
  }
  if (!config.sharedSecret) {
    console.warn(
      "[runner] RUNNER_SHARED_SECRET unset — /matches/:id/start is open (dev only)",
    );
  }
}

requireEnv();

const db = createClient(
  config.supabaseUrl || "http://localhost:54321",
  config.supabaseServiceKey || "dev-service-key",
);

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireRunnerSecret(req: Request, res: Response, next: NextFunction): void {
  if (!config.sharedSecret) {
    next();
    return;
  }
  const header = req.header("x-arena-secret") ?? "";
  const bearer = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const provided = header || bearer;
  if (provided !== config.sharedSecret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

/** Print cost estimate on boot — Part 6 gate before matches run. */
function printCostBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  ITLIED — COST GATE (Part 6)                             ║
╠══════════════════════════════════════════════════════════╣
║  Model:     ${MODEL_PRICING.model.padEnd(43)}║
║  Ceiling:   ${String(MATCH_LIMITS.tokens).padEnd(8)} tokens / agent${" ".repeat(24)}║
║  Match $:   $${(CEILING_COST_CENTS_PER_MATCH / 100).toFixed(2)} at ceiling (both agents)${" ".repeat(14)}║
║  Day cap:   $${(DAILY_BUDGET_CENTS / 100).toFixed(0)} → ~${Math.floor(DAILY_BUDGET_CENTS / CEILING_COST_CENTS_PER_MATCH)} matches${" ".repeat(27)}║
║  Kill switch armed. Matchmaking halts when cap crossed.  ║
╚══════════════════════════════════════════════════════════╝
`);
}

app.get("/health", (_req, res) => {
  const providers = providerStatus();
  res.json({
    ok: true,
    model: config.model,
    baseUrl: config.openaiBaseUrl,
    dryRun: config.dryRun,
    dockerDisabled: process.env.ARENA_NO_DOCKER === "1" || config.dryRun,
    authRequired: Boolean(config.sharedSecret),
    providers,
  });
});

app.get("/budget", async (_req, res) => {
  try {
    const status = await getBudgetStatus(db);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Enqueue / start a match. Refuses immediately if the daily kill switch is on.
 * Atomically reserves ceiling cost before work begins.
 */
app.post("/matches/:id/start", requireRunnerSecret, async (req, res) => {
  const matchId = req.params.id;
  try {
    const { data: matchRow } = await db
      .from("matches")
      .select("model_id")
      .eq("id", matchId)
      .maybeSingle();
    let reserveCents = CEILING_COST_CENTS_PER_MATCH;
    try {
      if (matchRow?.model_id) {
        reserveCents = ceilingCostCentsForModel(assertModel(matchRow.model_id));
      }
    } catch {
      res.status(400).json({ error: "invalid_model" });
      return;
    }

    const budget = await reserveMatchBudget(db, reserveCents);
    if (!budget.allowed) {
      await db
        .from("matches")
        .update({ status: "budget_blocked", verdict: "BUDGET_KILL_SWITCH" })
        .eq("id", matchId);
      res.status(402).json({
        error: "daily_budget_exceeded",
        ...budget,
      });
      return;
    }

    res.status(202).json({ started: true, matchId, budget, reserveCents });
    runMatch(db, matchId, { alreadyReserved: true, reservedCents: reserveCents }).catch(
      async (err) => {
        console.error("[match]", matchId, err);
        await db
          .from("matches")
          .update({
            status: "cancelled",
            verdict: "RUNNER_ERROR",
            ended_at: new Date().toISOString(),
          })
          .eq("id", matchId);
      },
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/clips/:id/render", requireRunnerSecret, async (req, res) => {
  const clipId = req.params.id;
  try {
    res.status(202).json({ started: true, clipId });
    void processClipJobs(db, clipId).catch((err) =>
      console.error("[clip]", clipId, err),
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/tournaments/:id/advance", requireRunnerSecret, async (req, res) => {
  try {
    const result = await advanceTournament(db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

printCostBanner();
app.listen(config.port, () => {
  console.log(`[runner] listening on :${config.port}`);
});