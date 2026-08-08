export type MatchEventType =
  | "thought"
  | "tool_call"
  | "tool_result"
  | "test_run"
  | "verdict"
  | "tamper";

export type ToolName =
  | "read_file"
  | "write_file"
  | "run_shell"
  | "run_tests";

export type MatchStatus =
  | "queued"
  | "running"
  | "finished"
  | "cancelled"
  | "budget_blocked";

export type VerdictKind =
  | "WIN_A"
  | "WIN_B"
  | "TIMEOUT_A"
  | "TIMEOUT_B"
  | "TIMEOUT_BOTH"
  | "TAMPERED_A"
  | "TAMPERED_B"
  | "DRAW";

export interface MatchEventRow {
  id?: string;
  match_id: string;
  agent_id: string | null;
  seq: number;
  ts: string;
  type: MatchEventType;
  payload: Record<string, unknown>;
}

export interface ThoughtPayload {
  text: string;
}

export interface ToolCallPayload {
  tool: ToolName;
  args: Record<string, unknown>;
  call_id: string;
}

export interface ToolResultPayload {
  tool: ToolName;
  call_id: string;
  ok: boolean;
  output: string;
  truncated?: boolean;
}

export interface TestRunPayload {
  suite: "visible";
  passed: number;
  failed: number;
  output: string;
  duration_ms: number;
}

export interface TamperPayload {
  reason: string;
  /** Offending diff lines shown inline in the kill feed */
  diff_lines: string[];
  path: string;
}

export interface VerdictPayload {
  verdict: VerdictKind;
  winner_id: string | null;
  loser_id: string | null;
  reason: string;
  /** Single line that decided the match — travels on the verdict card */
  deciding_line: string;
  duration_ms: number;
  tokens_a: number;
  tokens_b: number;
}

/** Kill-feed announcer voice helpers */
export function killFeedLine(
  type: MatchEventType,
  payload: Record<string, unknown>,
  agentLabel: "A" | "B" | null,
): string {
  const who = agentLabel === "A" ? "BREAKER" : agentLabel === "B" ? "FIXER" : "REF";
  switch (type) {
    case "thought":
      return `${who} thinks`;
    case "tool_call": {
      const tool = payload.tool as string;
      const args = payload.args as Record<string, unknown>;
      if (tool === "read_file") return `${who} reads ${args.path ?? "file"}`;
      if (tool === "write_file") return `${who} writes ${args.path ?? "file"}`;
      if (tool === "run_shell") return `${who} shells ${String(args.cmd ?? "").slice(0, 40)}`;
      if (tool === "run_tests") return `${who} runs visible suite`;
      return `${who} calls ${tool}`;
    }
    case "tool_result": {
      const ok = payload.ok as boolean;
      return ok ? `${who} result ok` : `${who} result FAIL`;
    }
    case "test_run": {
      const failed = payload.failed as number;
      const passed = payload.passed as number;
      return failed === 0
        ? `${who} suite green ${passed} pass`
        : `${who} suite red ${failed} fail`;
    }
    case "tamper":
      return `${who} TAMPERS — ${(payload.reason as string) ?? "test file altered"}`;
    case "verdict":
      return `VERDICT ${(payload.verdict as string) ?? ""}`;
    default:
      return `${who} ${type}`;
  }
}
