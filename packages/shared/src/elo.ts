import { ELO } from "./constants.js";

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Standard Elo, K=32, seed 1200.
 * Returns new ratings for winner and loser.
 */
export function updateElo(
  winnerElo: number,
  loserElo: number,
): { winner: number; loser: number } {
  const expW = expectedScore(winnerElo, loserElo);
  const expL = expectedScore(loserElo, winnerElo);
  return {
    winner: Math.round(winnerElo + ELO.k * (1 - expW)),
    loser: Math.round(loserElo + ELO.k * (0 - expL)),
  };
}

/** Draw: both move toward each other slightly via 0.5 scores. */
export function updateEloDraw(
  eloA: number,
  eloB: number,
): { a: number; b: number } {
  const expA = expectedScore(eloA, eloB);
  const expB = expectedScore(eloB, eloA);
  return {
    a: Math.round(eloA + ELO.k * (0.5 - expA)),
    b: Math.round(eloB + ELO.k * (0.5 - expB)),
  };
}

export function estimateMatchCostCents(
  tokensInA: number,
  tokensOutA: number,
  tokensInB: number,
  tokensOutB: number,
  inputPerMillionUsd: number,
  outputPerMillionUsd: number,
): number {
  const usd =
    ((tokensInA + tokensInB) / 1_000_000) * inputPerMillionUsd +
    ((tokensOutA + tokensOutB) / 1_000_000) * outputPerMillionUsd;
  return Math.ceil(usd * 100);
}
