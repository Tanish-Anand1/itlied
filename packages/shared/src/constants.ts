/** Hard limits per agent, per match */
export const MATCH_LIMITS = {
  wallClockMs: 300_000,
  toolCalls: 40,
  /** Proxy-enforced token ceiling per agent */
  tokens: 80_000,
  containerMemoryMb: 512,
  containerCpus: 1,
} as const;

/** GPT-4.1 list prices (USD per 1M tokens), Aug 2026 */
export const MODEL_PRICING = {
  model: "gpt-4.1",
  temperature: 0.2,
  inputPerMillionUsd: 2.0,
  outputPerMillionUsd: 8.0,
} as const;

/**
 * Worst-case match cost at token ceiling with 75/25 in/out mix.
 * See COST.md. Encoded here so the kill switch and UI share one source.
 */
export const CEILING_COST_CENTS_PER_MATCH = 56; // $0.56

/** Daily spend cap — kill switch trips when crossed (UTC day). */
export const DAILY_BUDGET_CENTS = 5000; // $50 → ≈89 ceiling matches

export const ELO = {
  k: 32,
  seed: 1200,
} as const;

export const SHELL_WHITELIST = [
  "node",
  "npm",
  "ls",
  "cat",
  "grep",
  "git",
] as const;

/** @deprecated use FIXTURE_CATALOG / getFixture */
export { FIXTURE_ID_V1 } from "./fixtures.js";

export const DESIGN_TOKENS = {
  base: "#07080C",
  panel: "#101218",
  rule: "#2A2F3C",
  text: "#F0EBE3",
  muted: "#9AA3B5",
  breaker: "#5AD4FF",
  fixer: "#8EF0A8",
  verdict: "#FFB347",
} as const;
