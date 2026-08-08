import type { MatchEvent } from "@/lib/types";

/**
 * Replay engine — live is a special case of replay (speed=live, cursor follows tip).
 * Playback advances one event at a time so the bout is always visible.
 */
export type ReplayMode = "live" | "replay";

export interface ReplayState {
  mode: ReplayMode;
  speed: number;
  cursor: number;
  playing: boolean;
  originTs: number | null;
}

/** Base ms between events at 1× */
export const REPLAY_MS_PER_EVENT = 220;

export function eventsUpTo(events: MatchEvent[], cursor: number): MatchEvent[] {
  if (cursor < 0) return [];
  return events.slice(0, Math.min(cursor + 1, events.length));
}

export function agentEvents(
  events: MatchEvent[],
  agentId: string | null,
): MatchEvent[] {
  if (!agentId) return events.filter((e) => e.agent_id == null);
  return events.filter((e) => e.agent_id === agentId || e.type === "verdict");
}

export function killFeedEvents(events: MatchEvent[]): MatchEvent[] {
  return events.filter((e) =>
    ["tool_call", "test_run", "tamper", "verdict"].includes(e.type),
  );
}

export function formatMatchClock(startedAt: string | null, atTs: string): string {
  if (!startedAt) return "00:00";
  const ms = Math.max(0, new Date(atTs).getTime() - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function remainingClock(
  startedAt: string | null,
  now: number,
  limitMs = 300_000,
): string {
  if (!startedAt) return "05:00";
  const elapsed = now - new Date(startedAt).getTime();
  const left = Math.max(0, limitMs - elapsed);
  const s = Math.ceil(left / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")} left`;
}

export function countToolCalls(events: MatchEvent[], agentId: string): number {
  return events.filter((e) => e.agent_id === agentId && e.type === "tool_call").length;
}

export function estimateTokens(events: MatchEvent[], agentId: string, fallback: number): number {
  void agentId;
  return fallback;
}

/** Interval between event steps for playback. */
export function replayStepMs(speed: number, reduced = false): number {
  if (reduced) return Math.max(28, 55 / Math.max(speed, 0.01));
  return Math.max(48, REPLAY_MS_PER_EVENT / Math.max(speed, 0.01));
}

/** @deprecated — index stepping replaced progress mapping */
export function replayDurationMs(
  eventCount: number,
  fromIdx: number,
  speed: number,
): number {
  const remaining = Math.max(1, eventCount - 1 - Math.max(0, fromIdx));
  return remaining * replayStepMs(speed);
}

export function cursorForProgress(
  eventCount: number,
  fromIdx: number,
  progress: number,
): number {
  if (eventCount <= 0) return -1;
  const start = Math.max(0, Math.min(fromIdx, eventCount - 1));
  if (progress >= 1) return eventCount - 1;
  const span = eventCount - 1 - start;
  if (span <= 0) return eventCount - 1;
  return start + Math.min(span, Math.floor(progress * (span + 1)));
}

export function cursorForElapsed(
  events: MatchEvent[],
  elapsedMs: number,
  speed: number,
): number {
  if (events.length === 0) return -1;
  const duration = replayDurationMs(events.length, 0, speed);
  const progress = Math.min(1, elapsedMs / duration);
  return cursorForProgress(events.length, 0, progress);
}
