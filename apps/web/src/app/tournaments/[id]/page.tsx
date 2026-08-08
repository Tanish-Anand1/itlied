import { SiteNav } from "@/components/nav/SiteNav";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const [{ data: entrants }, { data: bracket }] = await Promise.all([
    supabase
      .from("tournament_entrants")
      .select("id, seed, eliminated, profile_id, agent_id, profiles(handle)")
      .eq("tournament_id", id)
      .order("seed", { ascending: true }),
    supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", id)
      .order("round", { ascending: true })
      .order("slot", { ascending: true }),
  ]);

  const rounds = [...new Set((bracket ?? []).map((b) => b.round))].sort(
    (a, b) => a - b,
  );

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          tournament · {t.status}
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">{t.name}</h1>
        <p className="mt-2 font-mono text-[12px] text-muted">
          {t.fixture_id} · {t.model_id} · {t.format} · bracket {t.bracket_size}
        </p>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            entrants
          </h2>
          <ul className="grid gap-0 font-mono text-[12px] sm:grid-cols-2">
            {(entrants ?? []).map((e) => (
              <li
                key={e.id}
                className="flex justify-between border-b border-rule px-3 py-2 sm:odd:border-r"
              >
                <span>
                  #{e.seed ?? "—"}{" "}
                  <Link
                    href={`/u/${(e as { profiles?: { handle?: string } }).profiles?.handle ?? ""}`}
                    className="text-breaker hover:underline"
                  >
                    @
                    {(e as { profiles?: { handle?: string } }).profiles?.handle ??
                      "unknown"}
                  </Link>
                </span>
                <span className={e.eliminated ? "text-verdict" : "text-fixer"}>
                  {e.eliminated ? "out" : "in"}
                </span>
              </li>
            ))}
            {!entrants?.length && (
              <li className="px-3 py-4 text-muted">registration empty</li>
            )}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            bracket
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {rounds.map((round) => (
              <div key={round} className="border border-rule">
                <div className="border-b border-rule bg-panel px-2 py-1.5 font-mono text-[11px] text-muted">
                  round {round}
                </div>
                <ul className="divide-y divide-rule font-mono text-[11px]">
                  {(bracket ?? [])
                    .filter((b) => b.round === round)
                    .map((b) => (
                      <li key={b.id} className="px-2 py-2">
                        <p className="text-muted">slot {b.slot}</p>
                        <p className="text-ink">
                          {shortId(b.entrant_a)} vs {shortId(b.entrant_b)}
                        </p>
                        {b.match_id && (
                          <Link
                            href={`/match/${b.match_id}`}
                            className="text-breaker hover:underline"
                          >
                            match →
                          </Link>
                        )}
                        {b.winner_entrant_id && (
                          <p className="text-fixer">
                            winner {shortId(b.winner_entrant_id)}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            {!rounds.length && (
              <p className="font-mono text-[12px] text-muted">
                bracket not seeded — ops advances when open
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 6);
}
