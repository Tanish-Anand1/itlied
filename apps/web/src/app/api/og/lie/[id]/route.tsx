import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import { lieHeadline, lieLabelFromVerdict, lieSubcopy } from "@/lib/lies";
import { createService } from "@/lib/supabase/service";
import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Viral IT LIED / CLEARED card — 1200×630. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let verdict = "WIN_B";
  let deciding = "";
  let fixture = "async-race";
  let handle = "anon";

  if (isDemoMode() || id === DEMO_MATCH_ID || id === "demo") {
    const v = demoBundle.events.find((e) => e.type === "verdict")?.payload ?? {};
    verdict = String(v.verdict ?? "TAMPERED_A");
    deciding = String(v.deciding_line ?? "");
    fixture = demoBundle.fixtureId;
    handle = demoBundle.agentA.handle;
  } else {
    const db = createService();
    const { data: match } = await db
      .from("matches")
      .select("verdict, fixture_id, agent_a")
      .eq("id", id)
      .maybeSingle();
    if (!match) return new Response("Not found", { status: 404 });
    verdict = String(match.verdict ?? "FINISHED");
    fixture = String(match.fixture_id);
    const { data: agent } = await db
      .from("agents")
      .select("profiles(handle)")
      .eq("id", match.agent_a)
      .maybeSingle();
    handle =
      (agent as { profiles?: { handle?: string } } | null)?.profiles?.handle ??
      "anon";
    const { data: ve } = await db
      .from("match_events")
      .select("payload")
      .eq("match_id", id)
      .eq("type", "verdict")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    deciding = String(
      (ve?.payload as { deciding_line?: string } | undefined)?.deciding_line ??
        "",
    );
  }

  const label = lieLabelFromVerdict(verdict);
  const headline = lieHeadline(label);
  const sub = lieSubcopy(label);
  const accent =
    label === "CLEARED" ? "#8EF0A8" : label === "IT_LIED" || label === "TAMPER" ? "#FFB347" : "#5AD4FF";

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
          padding: 56,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#9AA3B5" }}>
            ITLIED · LIE DETECTOR
          </div>
          <div style={{ fontSize: 20, color: "#9AA3B5" }}>@{handle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: 6,
              color: accent,
              lineHeight: 0.95,
            }}
          >
            {headline}
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "#9AA3B5", maxWidth: 900 }}>
            {sub}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#9AA3B5",
            borderTop: "1px solid #2A2F3C",
            paddingTop: 24,
          }}
        >
          <span>fixture {fixture}</span>
          <span>{deciding ? deciding.slice(0, 60) : "hidden suite decided"}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
