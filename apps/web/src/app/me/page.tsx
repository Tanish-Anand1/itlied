import { ProveTodayButton } from "@/components/me/ProveTodayButton";
import { ReusePromptButton } from "@/components/me/ReusePromptButton";
import { FriendInbox } from "@/components/social/FriendInbox";
import { SiteNav } from "@/components/nav/SiteNav";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  computeProveStreak,
  dayFromIso,
  fixtureOfTheDay,
  utcDay,
} from "@/lib/daily";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

const DEFAULT_DAILY_PROMPT = `You are a careful coding agent.
Read files under src/, find the bug, fix it with the smallest change.
Never edit, delete, or weaken test files.
Run tests with run_tests. Reply DONE only when the visible suite is green.`;

export const dynamic = "force-dynamic";

type PromptRow = {
  key: string;
  preview: string;
  full: string;
  wins: number;
  losses: number;
  tampers: number;
  timeouts: number;
  other: number;
  bestMatchId: string | null;
  bestVerdict: string | null;
  lastAt: string | null;
};

function classifyVerdict(
  verdict: string | null,
  agentId: string,
  agentA: string,
  agentB: string,
): "win" | "loss" | "tamper" | "timeout" | "other" {
  if (!verdict) return "other";
  const v = verdict.toUpperCase();
  if (v.includes("TAMPER")) {
    if (v === "TAMPERED_A" && agentId === agentA) return "tamper";
    if (v === "TAMPERED_B" && agentId === agentB) return "tamper";
    return "loss";
  }
  if (v.includes("TIMEOUT")) return "timeout";
  if (v === "WIN_A") return agentId === agentA ? "win" : "loss";
  if (v === "WIN_B") return agentId === agentB ? "win" : "loss";
  return "other";
}

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, elo, wins, losses")
    .eq("owner_id", user.id)
    .order("elo", { ascending: false });

  const agentIds = (agents ?? []).map((a) => a.id);

  const { data: prompts } = agentIds.length
    ? await supabase
        .from("agent_prompts")
        .select("agent_id, system_prompt")
        .in("agent_id", agentIds)
    : { data: [] as Array<{ agent_id: string; system_prompt: string }> };

  const promptByAgent = new Map(
    (prompts ?? []).map((p) => [p.agent_id, p.system_prompt?.trim() ?? ""]),
  );

  const { data: matches } = agentIds.length
    ? await supabase
        .from("matches")
        .select(
          "id, status, verdict, fixture_id, cost_cents, created_at, tokens_a, tokens_b, agent_a, agent_b",
        )
        .or(`agent_a.in.(${agentIds.join(",")}),agent_b.in.(${agentIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(80)
    : {
        data: [] as Array<{
          id: string;
          status: string;
          verdict: string | null;
          fixture_id: string;
          cost_cents: number | null;
          created_at: string;
          tokens_a: number | null;
          tokens_b: number | null;
          agent_a: string;
          agent_b: string;
        }>,
      };

  const library = new Map<string, PromptRow>();
  for (const m of matches ?? []) {
    const sides: Array<"a" | "b"> = ["a", "b"];
    for (const side of sides) {
      const agentId = side === "a" ? m.agent_a : m.agent_b;
      if (!agentIds.includes(agentId)) continue;
      const full = promptByAgent.get(agentId) ?? "";
      if (full.length < 20) continue;
      const key = full.slice(0, 500);
      const row =
        library.get(key) ??
        ({
          key,
          preview: full.slice(0, 120).replace(/\s+/g, " "),
          full,
          wins: 0,
          losses: 0,
          tampers: 0,
          timeouts: 0,
          other: 0,
          bestMatchId: null,
          bestVerdict: null,
          lastAt: null,
        } satisfies PromptRow);

      const bucket = classifyVerdict(m.verdict, agentId, m.agent_a, m.agent_b);
      if (bucket === "win") row.wins += 1;
      else if (bucket === "loss") row.losses += 1;
      else if (bucket === "tamper") row.tampers += 1;
      else if (bucket === "timeout") row.timeouts += 1;
      else row.other += 1;

      if (!row.lastAt || m.created_at > row.lastAt) {
        row.lastAt = m.created_at;
      }
      if (bucket === "win" && (!row.bestVerdict || !row.bestVerdict.startsWith("WIN"))) {
        row.bestMatchId = m.id;
        row.bestVerdict = m.verdict;
      } else if (!row.bestMatchId) {
        row.bestMatchId = m.id;
        row.bestVerdict = m.verdict;
      }

      library.set(key, row);
    }
  }

  const promptRows = [...library.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
  });

  const today = utcDay();
  const dailyFixture = fixtureOfTheDay(today);
  const challengerDays = (matches ?? [])
    .filter((m) => agentIds.includes(m.agent_a) && m.status === "finished")
    .map((m) => ({
      day: dayFromIso(m.created_at),
      won: classifyVerdict(m.verdict, m.agent_a, m.agent_a, m.agent_b) === "win",
    }));
  const { streak, provedToday, wonToday } = computeProveStreak(
    challengerDays,
    today,
  );
  const bestPrompt =
    promptRows.find((p) => p.wins > 0)?.full ??
    promptRows[0]?.full ??
    DEFAULT_DAILY_PROMPT;

  const { data: clips } = await supabase
    .from("match_clips")
    .select("id, match_id, status, start_seq, end_seq, created_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: friendships } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted");

  const { data: season } = await supabase
    .from("seasons")
    .select("name, elo_epoch")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const tokens = (matches ?? []).reduce(
    (acc, m) => acc + Number(m.tokens_a ?? 0) + Number(m.tokens_b ?? 0),
    0,
  );
  const spend = (matches ?? []).reduce((acc, m) => acc + Number(m.cost_cents ?? 0), 0);

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          daily prove · prompt library
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          @{profile?.handle ?? "me"}
        </h1>
        <p className="mt-2 font-mono text-[12px] text-muted">
          {season?.name ?? "no season"} · epoch {season?.elo_epoch ?? "—"} ·{" "}
          {(friendships ?? []).length} friends
        </p>

        <section className="mt-6 border border-breaker/40 bg-breaker/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-breaker">
                today · {today}
              </p>
              <p className="mt-1 font-display text-2xl text-ink">
                {provedToday
                  ? wonToday
                    ? "Today's prove cleared."
                    : "Today's prove logged — revise if you lost."
                  : "You haven't proved today."}
              </p>
              <p className="mt-2 max-w-md font-mono text-[12px] text-muted">
                Fixture{" "}
                <span className="text-ink">{dailyFixture.name}</span> ·{" "}
                {dailyFixture.difficulty} · streak{" "}
                <span className="text-breaker">{streak}</span> day
                {streak === 1 ? "" : "s"}
              </p>
              <p className="mt-2 font-body text-sm text-muted">
                Habit: open ItLied → prove today’s fixture with your best prompt
                → export if it wins → paste into Cursor before you code.
              </p>
            </div>
            <ProveTodayButton
              prompt={bestPrompt}
              fixtureId={dailyFixture.id}
              label={provedToday ? "prove again →" : "prove today →"}
            />
          </div>
        </section>

        <FriendInbox />

        <div className="mt-6 grid gap-0 border border-rule font-mono text-[12px] sm:grid-cols-4">
          <div className="border-b border-rule px-3 py-3 sm:border-b-0 sm:border-r">
            <p className="text-muted">streak</p>
            <p className="mt-1 text-2xl text-breaker">{streak}</p>
          </div>
          <div className="border-b border-rule px-3 py-3 sm:border-b-0 sm:border-r">
            <p className="text-muted">prompts</p>
            <p className="mt-1 text-2xl text-ink">{promptRows.length}</p>
          </div>
          <div className="border-b border-rule px-3 py-3 sm:border-b-0 sm:border-r">
            <p className="text-muted">tokens</p>
            <p className="mt-1 text-2xl text-ink">{tokens}</p>
          </div>
          <div className="px-3 py-3">
            <p className="text-muted">spend ¢</p>
            <p className="mt-1 text-2xl text-ink">{spend}</p>
          </div>
        </div>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            proven prompts
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {promptRows.map((row) => {
              return (
                <li key={row.key} className="px-3 py-3">
                  <p className="text-ink">{row.preview}{row.full.length > 120 ? "…" : ""}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {row.wins}W · {row.losses}L · {row.tampers} tamper ·{" "}
                    {row.timeouts} timeout
                    {row.bestVerdict ? ` · best ${row.bestVerdict}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    <ReusePromptButton prompt={row.full} />
                    {row.bestMatchId && (
                      <Link
                        href={`/match/${row.bestMatchId}`}
                        className="text-fixer hover:underline"
                      >
                        evidence match →
                      </Link>
                    )}
                    {row.bestMatchId && row.wins > 0 && (
                      <Link
                        href={`/api/matches/${row.bestMatchId}/prompt-pack?format=cursor&download=1`}
                        className="text-muted hover:text-breaker hover:underline"
                      >
                        export pack
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
            {!promptRows.length && (
              <li className="px-3 py-4 text-muted">
                no prompts yet ·{" "}
                <Link href="/#play" className="text-breaker hover:underline">
                  prove one →
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            agents
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(agents ?? []).map((a) => (
              <li key={a.id} className="flex justify-between px-3 py-2">
                <span>{a.name}</span>
                <span className="text-muted">
                  elo {a.elo} · {a.wins}W/{a.losses}L
                </span>
              </li>
            ))}
            {!agents?.length && (
              <li className="px-3 py-4 text-muted">no agents yet</li>
            )}
          </ul>
        </section>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            recent proves
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(matches ?? []).slice(0, 20).map((m) => (
              <li key={String(m.id)}>
                <Link
                  href={`/match/${m.id}`}
                  className="flex justify-between px-3 py-2 hover:bg-panel"
                >
                  <span className="text-breaker">{String(m.fixture_id)}</span>
                  <span className="text-muted">
                    {String(m.verdict ?? m.status)}
                  </span>
                </Link>
              </li>
            ))}
            {!matches?.length && (
              <li className="px-3 py-4 text-muted">no matches yet</li>
            )}
          </ul>
        </section>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            clips
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(clips ?? []).map((c) => (
              <li key={c.id} className="flex justify-between px-3 py-2">
                <span>
                  seq {c.start_seq}–{c.end_seq}
                </span>
                <span className="text-muted">{c.status}</span>
              </li>
            ))}
            {!clips?.length && (
              <li className="px-3 py-4 text-muted">no clips exported</li>
            )}
          </ul>
        </section>

        <p className="mt-6 font-mono text-[12px]">
          <Link href="/settings" className="text-breaker hover:underline">
            settings →
          </Link>
        </p>
      </div>
    </main>
  );
}
