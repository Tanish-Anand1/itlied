/**
 * Global kill switch — built before the first match ever runs.
 * Halts matchmaking when the day's spend crosses DAILY_BUDGET_CENTS.
 * Reserve is atomic at start; finalize adjusts actual spend and releases reserve.
 */
import { CEILING_COST_CENTS_PER_MATCH, DAILY_BUDGET_CENTS } from "@agentarena/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export interface BudgetStatus {
  allowed: boolean;
  day: string;
  spendCents: number;
  reservedCents: number;
  budgetCents: number;
  killSwitch: boolean;
  ceilingCostCents: number;
  remainingMatchesAtCeiling: number;
  reserveCents?: number;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapStatus(row: {
  allowed?: boolean;
  day?: string;
  spend_cents?: number;
  reserved_cents?: number;
  budget_cents?: number;
  kill_switch?: boolean;
  reserve_cents?: number;
}): BudgetStatus {
  const budgetCents = row.budget_cents ?? (config.dailyBudgetCents || DAILY_BUDGET_CENTS);
  const spendCents = row.spend_cents ?? 0;
  const reservedCents = row.reserved_cents ?? 0;
  const killSwitch = Boolean(row.kill_switch) || spendCents + reservedCents >= budgetCents;
  const remaining = Math.max(
    0,
    Math.floor((budgetCents - spendCents - reservedCents) / CEILING_COST_CENTS_PER_MATCH),
  );
  return {
    allowed: row.allowed !== undefined ? Boolean(row.allowed) : !killSwitch,
    day: row.day ?? utcDay(),
    spendCents,
    reservedCents,
    budgetCents,
    killSwitch,
    ceilingCostCents: CEILING_COST_CENTS_PER_MATCH,
    remainingMatchesAtCeiling: remaining,
    reserveCents: row.reserve_cents,
  };
}

export async function getBudgetStatus(db: SupabaseClient): Promise<BudgetStatus> {
  const day = utcDay();
  const budgetCents = config.dailyBudgetCents || DAILY_BUDGET_CENTS;

  await db.from("daily_spend").upsert({ day }, { onConflict: "day", ignoreDuplicates: true });

  const { data } = await db
    .from("daily_spend")
    .select("spend_cents, reserved_cents, kill_switch")
    .eq("day", day)
    .maybeSingle();

  return mapStatus({
    day,
    spend_cents: data?.spend_cents ?? 0,
    reserved_cents: data?.reserved_cents ?? 0,
    budget_cents: budgetCents,
    kill_switch: Boolean(data?.kill_switch),
  });
}

/** Gate without reserving — status checks / UI. */
export async function assertBudgetAllowsMatch(db: SupabaseClient): Promise<BudgetStatus> {
  const status = await getBudgetStatus(db);
  if (!status.allowed) {
    await db
      .from("daily_spend")
      .update({ kill_switch: true, updated_at: new Date().toISOString() })
      .eq("day", status.day);
  }
  return status;
}

/** Atomic reserve at match start. Returns allowed=false if kill switch trips. */
export async function reserveMatchBudget(
  db: SupabaseClient,
  reserveCents = CEILING_COST_CENTS_PER_MATCH,
): Promise<BudgetStatus> {
  const { data, error } = await db.rpc("reserve_match_budget", {
    p_reserve_cents: reserveCents,
  });
  if (error) {
    throw new Error(`reserve_match_budget failed: ${error.message}`);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return mapStatus({
    allowed: Boolean(row.allowed),
    day: String(row.day ?? utcDay()),
    spend_cents: Number(row.spend_cents ?? 0),
    reserved_cents: Number(row.reserved_cents ?? 0),
    budget_cents: Number(row.budget_cents ?? (config.dailyBudgetCents || DAILY_BUDGET_CENTS)),
    kill_switch: Boolean(row.kill_switch),
    reserve_cents: Number(row.reserve_cents ?? reserveCents),
  });
}

export async function finalizeMatchSpend(
  db: SupabaseClient,
  costCents: number,
  reserveCents = CEILING_COST_CENTS_PER_MATCH,
): Promise<void> {
  const { error } = await db.rpc("finalize_match_spend", {
    p_cost_cents: costCents,
    p_reserve_cents: reserveCents,
  });
  if (error) {
    // Fallback for DBs that only have record_match_spend
    console.error("[budget] finalize_match_spend:", error.message);
    await db.rpc("record_match_spend", { p_cost_cents: costCents });
  }
}

/** @deprecated Prefer finalizeMatchSpend after reserve. */
export async function recordSpend(db: SupabaseClient, costCents: number): Promise<BudgetStatus> {
  await finalizeMatchSpend(db, costCents, 0);
  return getBudgetStatus(db);
}
