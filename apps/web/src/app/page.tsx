import { Wordmark } from "@/components/brand/Wordmark";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingHero } from "@/components/landing/LandingHero";
import { LieTicker } from "@/components/landing/LieTicker";
import { RecentReplay } from "@/components/landing/RecentReplay";
import { SiteNav } from "@/components/nav/SiteNav";
import { getSessionUser } from "@/lib/auth";
import { fixtureOfTheDay, utcDay } from "@/lib/daily";
import { isDemoMode } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getTamperStats(): Promise<{ count: number; perHour: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { count: 0, perHour: 0 };
  }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/tamper_count`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const count = res.ok ? Number(await res.json()) : 0;
    const safe = Number.isFinite(count) ? Math.max(0, count) : 0;
    if (safe === 0) return { count: 0, perHour: 0 };
    const launch = Date.parse(
      process.env.NEXT_PUBLIC_LAUNCH_AT ?? "2026-08-01T00:00:00Z",
    );
    const hours = Math.max(1, (Date.now() - launch) / 3_600_000);
    return { count: safe, perHour: Math.round(safe / hours) };
  } catch {
    return { count: 0, perHour: 0 };
  }
}

async function loadRevise(matchId: string): Promise<{
  prompt: string;
  decidingLine: string | null;
} | null> {
  try {
    const supabase = await createClient();
    const { data: match } = await supabase
      .from("matches")
      .select("id, agent_a, status")
      .eq("id", matchId)
      .maybeSingle();
    if (!match || match.status !== "finished") return null;

    const [{ data: promptRow }, { data: events }] = await Promise.all([
      supabase
        .from("agent_prompts")
        .select("system_prompt")
        .eq("agent_id", match.agent_a)
        .maybeSingle(),
      supabase
        .from("match_events")
        .select("type, payload, seq")
        .eq("match_id", matchId)
        .eq("type", "verdict")
        .order("seq", { ascending: false })
        .limit(1),
    ]);

    const prompt = promptRow?.system_prompt?.trim();
    if (!prompt) return null;
    const decidingLine = events?.[0]
      ? String(
          (events[0].payload as { deciding_line?: string })?.deciding_line ??
            (events[0].payload as { reason?: string })?.reason ??
            "",
        ) || null
      : null;
    return { prompt, decidingLine };
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ revise?: string; prompt?: string }>;
}) {
  const stats = await getTamperStats();
  const sp = await searchParams;
  const revise = sp.revise ? await loadRevise(sp.revise) : null;
  const fromQuery =
    typeof sp.prompt === "string" && sp.prompt.trim().length >= 20
      ? sp.prompt
      : "";
  const demo = isDemoMode();
  const user = await getSessionUser();
  const today = fixtureOfTheDay(utcDay());

  return (
    <main>
      <SiteNav />
      <LieTicker />

      <LandingHero
        tamperCount={stats.count}
        perHour={stats.perHour}
        initialPrompt={revise?.prompt ?? fromQuery}
        initialFixtureId={today.id}
        dailyLabel={`today's prove · ${today.name} · ${today.difficulty}`}
        reviseNote={revise?.decidingLine ?? null}
        demoMode={demo}
        signedIn={Boolean(user)}
      />

      <HowItWorks />

      <section id="watch" className="border-t border-rule">
        <div className="page-shell-wide flex items-baseline justify-between gap-[var(--space-4)] py-[var(--space-5)]">
          <h2 className="type-title text-ink">A real tamper, live</h2>
          <Link
            href="/cinema/demo"
            className="pressable type-meta shrink-0 text-breaker hover:underline"
          >
            full screen →
          </Link>
        </div>
        <div className="h-[min(65vh,580px)] min-h-[320px] border-t border-rule">
          <RecentReplay />
        </div>
      </section>

      <footer className="border-t border-rule py-[var(--space-7)] pb-[max(var(--space-7),env(safe-area-inset-bottom))]">
        <div className="page-shell">
          <Wordmark size="sm" />
          <p className="font-body mt-[var(--space-3)] max-w-[36ch] text-[var(--text-body-sm)] text-muted">
            If your agent can delete the tests and call it green — it lied.
          </p>
        </div>
      </footer>
    </main>
  );
}
