import { SiteNav } from "@/components/nav/SiteNav";
import { DEMO_MATCH_ID, demoBundle, isDemoMode } from "@/lib/demo/match";
import {
  lieHeadline,
  lieLabelFromVerdict,
  lieSubcopy,
} from "@/lib/lies";
import { createService } from "@/lib/supabase/service";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function loadLie(id: string) {
  if (isDemoMode() || id === "demo" || id === DEMO_MATCH_ID) {
    const v = demoBundle.events.find((e) => e.type === "verdict")?.payload ?? {};
    return {
      id: DEMO_MATCH_ID,
      verdict: String(v.verdict ?? "TAMPERED_A"),
      deciding: String(v.deciding_line ?? ""),
      fixture: demoBundle.fixtureId,
      handle: demoBundle.agentA.handle,
    };
  }
  const db = createService();
  const { data: match } = await db
    .from("matches")
    .select("id, verdict, fixture_id, agent_a, status")
    .eq("id", id)
    .maybeSingle();
  if (!match || match.status !== "finished") return null;
  const [{ data: agent }, { data: ve }] = await Promise.all([
    db
      .from("agents")
      .select("profiles(handle)")
      .eq("id", match.agent_a)
      .maybeSingle(),
    db
      .from("match_events")
      .select("payload")
      .eq("match_id", id)
      .eq("type", "verdict")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    id: match.id,
    verdict: String(match.verdict ?? "FINISHED"),
    deciding: String(
      (ve?.payload as { deciding_line?: string } | undefined)?.deciding_line ??
        "",
    ),
    fixture: String(match.fixture_id),
    handle:
      (agent as { profiles?: { handle?: string } } | null)?.profiles?.handle ??
      "anon",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lie = await loadLie(id);
  if (!lie) return { title: "ItLied" };
  const label = lieLabelFromVerdict(lie.verdict);
  const headline = lieHeadline(label);
  return {
    title: `${headline} · ItLied`,
    description: lieSubcopy(label),
    openGraph: {
      title: `${headline} · @${lie.handle}`,
      description: lieSubcopy(label),
      images: [`/api/og/lie/${lie.id}`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${headline} · @${lie.handle}`,
      images: [`/api/og/lie/${lie.id}`],
    },
  };
}

export default async function LiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lie = await loadLie(id);
  if (!lie) {
    return (
      <main>
        <SiteNav />
        <p className="p-8 font-mono text-muted">prove not found or still running</p>
      </main>
    );
  }

  const label = lieLabelFromVerdict(lie.verdict);
  const headline = lieHeadline(label);
  const accent =
    label === "CLEARED"
      ? "text-fixer"
      : label === "IT_LIED" || label === "TAMPER"
        ? "text-verdict"
        : "text-breaker";

  return (
    <main>
      <SiteNav />
      <div className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col justify-center px-4 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          lie detector · @{lie.handle} · {lie.fixture}
        </p>
        <h1
          className={`mt-4 font-display text-[clamp(3.5rem,14vw,7rem)] leading-[0.85] tracking-[-0.04em] ${accent}`}
        >
          {headline}
        </h1>
        <p className="mt-6 max-w-xl font-body text-lg text-muted">
          {lieSubcopy(label)}
        </p>
        {lie.deciding && (
          <p className="mt-4 font-mono text-[13px] text-ink">
            deciding · {lie.deciding}
          </p>
        )}

        <div className="mt-10 flex flex-wrap gap-3 font-mono text-[12px]">
          <Link
            href={`/cinema/${lie.id === DEMO_MATCH_ID ? "demo" : lie.id}`}
            className="pressable border border-breaker bg-breaker/15 px-4 py-3 uppercase tracking-[0.16em] text-breaker"
          >
            watch cinema →
          </Link>
          <Link
            href={`/match/${lie.id === DEMO_MATCH_ID ? "demo" : lie.id}`}
            className="pressable border border-rule px-4 py-3 uppercase tracking-[0.16em] text-ink"
          >
            export pack →
          </Link>
          <a
            href={`/api/og/lie/${lie.id === DEMO_MATCH_ID ? "demo" : lie.id}`}
            className="pressable border border-rule px-4 py-3 uppercase tracking-[0.16em] text-muted"
            download
          >
            download card
          </a>
          <Link
            href="/#play"
            className="pressable border border-verdict/40 px-4 py-3 uppercase tracking-[0.16em] text-verdict"
          >
            detect my lie →
          </Link>
        </div>
      </div>
    </main>
  );
}
