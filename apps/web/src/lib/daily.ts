import { FIXTURE_CATALOG, type FixtureMeta } from "@agentarena/shared";

/** UTC calendar day YYYY-MM-DD */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Rotate fixtures by UTC day so "today's prove" changes. */
export function fixtureOfTheDay(day: string = utcDay()): FixtureMeta {
  const list = FIXTURE_CATALOG;
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return list[h % list.length] ?? list[0];
}

export interface DayActivity {
  day: string;
  proved: boolean;
  won: boolean;
  matchId: string | null;
}

/** Consecutive UTC days ending today (or yesterday if today empty) with a prove. */
export function computeProveStreak(
  matchDays: Array<{ day: string; won: boolean }>,
  today: string = utcDay(),
): { streak: number; provedToday: boolean; wonToday: boolean } {
  const byDay = new Map<string, { proved: boolean; won: boolean }>();
  for (const m of matchDays) {
    const cur = byDay.get(m.day) ?? { proved: false, won: false };
    cur.proved = true;
    if (m.won) cur.won = true;
    byDay.set(m.day, cur);
  }

  const todayHit = byDay.get(today);
  const provedToday = Boolean(todayHit?.proved);
  const wonToday = Boolean(todayHit?.won);

  let cursor = provedToday ? today : prevUtcDay(today);
  let streak = 0;
  while (byDay.get(cursor)?.proved) {
    streak += 1;
    cursor = prevUtcDay(cursor);
  }
  return { streak, provedToday, wonToday };
}

function prevUtcDay(day: string): string {
  const t = Date.parse(`${day}T12:00:00.000Z`) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function dayFromIso(iso: string): string {
  return iso.slice(0, 10);
}
