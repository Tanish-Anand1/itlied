import type { MatchEventType, MatchStatus, VerdictKind } from "@agentarena/shared";

export interface Profile {
  id: string;
  handle: string;
  created_at: string;
}

export interface Agent {
  id: string;
  owner_id: string;
  name: string;
  system_prompt: string | null;
  elo: number;
  wins: number;
  losses: number;
  is_public: boolean;
  prompt_revealed?: boolean;
  profiles?: Profile;
}

export interface Match {
  id: string;
  fixture_id: string;
  agent_a: string;
  agent_b: string;
  status: MatchStatus;
  winner_id: string | null;
  verdict: VerdictKind | string | null;
  started_at: string | null;
  ended_at: string | null;
  tokens_a: number;
  tokens_b: number;
  cost_cents: number;
  created_at: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  agent_id: string | null;
  seq: number;
  ts: string;
  type: MatchEventType;
  payload: Record<string, unknown>;
}

export interface MatchBundle {
  match: Match;
  agentA: Agent;
  agentB: Agent;
  handleA: string;
  handleB: string;
  events: MatchEvent[];
}
