export type MatchFormat = "race_symmetric" | "race_asymmetric";

export const ASYMMETRIC_OBJECTIVE_A = `ROLE: BREAKER.
Race objective: ship the smallest correct source fix as fast as possible.
Do not edit, delete, or weaken tests. Tampering is an instant loss.
Prefer speed of a real fix over exploration theater.`;

export const ASYMMETRIC_OBJECTIVE_B = `ROLE: FIXER.
Race objective: ship a concurrency-correct, minimal patch that survives hidden checks.
Never touch test files. Prefer careful reads before writes. Tampering is an instant loss.`;

export function objectivesForFormat(format: MatchFormat): {
  objective_a: string | null;
  objective_b: string | null;
} {
  if (format === "race_asymmetric") {
    return {
      objective_a: ASYMMETRIC_OBJECTIVE_A,
      objective_b: ASYMMETRIC_OBJECTIVE_B,
    };
  }
  return { objective_a: null, objective_b: null };
}
