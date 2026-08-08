import { ImageResponse } from "next/og";
import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import { createService } from "@/lib/supabase/service";

export const runtime = "edge";

/** Verdict card as OG image — 1200×630. Blame the agent, not the human. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let nameA = "BREAKER";
  let nameB = "FIXER";
  let handleA = "breaker";
  let handleB = "fixer";
  let verdict = "FINISHED";
  let deciding = "";
  let duration = "00:00";
  let winnerId: string | null = null;
  let agentAId = "";
  let agentBId = "";

  if (isDemoMode() || id === DEMO_MATCH_ID || id === "demo") {
    nameA = demoBundle.agentA.name;
    nameB = demoBundle.agentB.name;
    handleA = demoBundle.agentA.handle;
    handleB = demoBundle.agentB.handle;
    agentAId = demoBundle.agentA.id;
    agentBId = demoBundle.agentB.id;
    const v = demoBundle.events.find((e) => e.type === "verdict")?.payload ?? {};
    verdict = String(v.verdict ?? "TAMPERED_A").replace(/_/g, " ");
    deciding = String(v.deciding_line ?? "");
    const durationMs = Number(v.duration_ms ?? 110000);
    const s = Math.floor(durationMs / 1000);
    duration = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    winnerId = (v.winner_id as string) ?? demoBundle.agentB.id;
  } else {
    const db = createService();
    const { data: match } = await db.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match) return new Response("Not found", { status: 404 });

    const [{ data: a }, { data: b }, { data: verdictEvent }] = await Promise.all([
      db.from("agents").select("name, profiles(handle)").eq("id", match.agent_a).single(),
      db.from("agents").select("name, profiles(handle)").eq("id", match.agent_b).single(),
      db
        .from("match_events")
        .select("payload")
        .eq("match_id", id)
        .eq("type", "verdict")
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    nameA = a?.name ?? "BREAKER";
    nameB = b?.name ?? "FIXER";
    handleA =
      (a as { profiles?: { handle?: string } } | null)?.profiles?.handle ?? "anon";
    handleB =
      (b as { profiles?: { handle?: string } } | null)?.profiles?.handle ?? "anon";
    agentAId = match.agent_a;
    agentBId = match.agent_b;
    const payload = (verdictEvent?.payload ?? {}) as Record<string, unknown>;
    verdict = String(match.verdict ?? payload.verdict ?? "FINISHED").replace(/_/g, " ");
    deciding = String(payload.deciding_line ?? payload.reason ?? "");
    const durationMs = Number(payload.duration_ms ?? 0);
    const s = Math.floor(durationMs / 1000);
    duration = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    winnerId = match.winner_id as string | null;
  }

  const shortId = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  const isTamper = verdict.includes("TAMPER");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07080C",
          color: "#F0EBE3",
          padding: 64,
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              color: "#9AA3B5",
              textTransform: "uppercase",
            }}
          >
            {`>_ ITLIED · MATCH ${shortId}`}
          </div>
          <div style={{ fontSize: 22, color: "#9AA3B5" }}>{duration}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 16, color: "#5AD4FF", letterSpacing: 4 }}>BREAKER</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#F0EBE3",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {nameA}
            </div>
            <div style={{ fontSize: 16, color: "#9AA3B5", marginTop: 6 }}>@{handleA}</div>
            {winnerId === agentAId && (
              <div style={{ fontSize: 18, color: "#5AD4FF", marginTop: 8 }}>AGENT WINS</div>
            )}
          </div>
          <div style={{ fontSize: 40, color: "#9AA3B5" }}>VS</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 16, color: "#8EF0A8", letterSpacing: 4 }}>FIXER</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#F0EBE3",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {nameB}
            </div>
            <div style={{ fontSize: 16, color: "#9AA3B5", marginTop: 6 }}>@{handleB}</div>
            {winnerId === agentBId && (
              <div style={{ fontSize: 18, color: "#8EF0A8", marginTop: 8 }}>AGENT WINS</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: isTamper ? "#FFB347" : "#F0EBE3",
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            {verdict}
          </div>
          <div style={{ fontSize: 24, color: "#9AA3B5", marginTop: 16 }}>
            {deciding || "Hidden suite decided the match."}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
