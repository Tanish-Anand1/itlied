import type { MatchEventType } from "@agentarena/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append-only event log. seq is monotonic per match via DB serialization
 * (append_match_event locks the match row) so parallel agent loops cannot collide.
 */
export class EventLog {
  constructor(
    private readonly db: SupabaseClient,
    private readonly matchId: string,
  ) {}

  async append(
    type: MatchEventType,
    payload: Record<string, unknown>,
    agentId: string | null = null,
  ): Promise<number> {
    const { data, error } = await this.db.rpc("append_match_event", {
      p_match_id: this.matchId,
      p_agent_id: agentId,
      p_type: type,
      p_payload: payload,
    });

    if (error) {
      console.error("[eventlog] rpc failed, refusing silent drop:", error.message);
      throw new Error(`append_match_event failed: ${error.message}`);
    }

    return Number(data);
  }
}
