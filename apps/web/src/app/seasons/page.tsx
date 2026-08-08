import { SiteNav } from "@/components/nav/SiteNav";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .order("starts_at", { ascending: false });
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, status, bracket_size, fixture_id, season_id")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-3xl text-ink">Seasons</h1>
        <p className="mt-2 font-mono text-[12px] text-muted">
          Elo epoch · single-elim brackets
        </p>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            active epochs
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(seasons ?? []).map((s) => (
              <li key={s.id} className="flex justify-between px-3 py-3">
                <span className="text-ink">{s.name}</span>
                <span className="text-muted">
                  epoch {s.elo_epoch}
                  {s.active ? " · active" : ""}
                </span>
              </li>
            ))}
            {!seasons?.length && (
              <li className="px-3 py-4 text-muted">no seasons seeded</li>
            )}
          </ul>
        </section>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            tournaments
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(tournaments ?? []).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="flex justify-between px-3 py-3 hover:bg-panel"
                >
                  <span className="text-breaker">{t.name}</span>
                  <span className="text-muted">
                    {t.status} · {t.bracket_size} · {t.fixture_id}
                  </span>
                </Link>
              </li>
            ))}
            {!tournaments?.length && (
              <li className="px-3 py-4 text-muted">no tournaments yet</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
