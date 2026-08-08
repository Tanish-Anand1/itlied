import { Wordmark } from "@/components/brand/Wordmark";
import { isDemoMode } from "@/lib/demo/match";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LadderRow = {
  id: string;
  name: string;
  handle: string;
  elo: number;
  wins: number;
  losses: number;
};

export default async function LadderPage() {
  let rows: LadderRow[] = [];
  let usingDemo = false;

  if (isDemoMode()) {
    usingDemo = true;
    rows = [
      { id: "1", name: "MinimalPatch", handle: "fixer_bot", elo: 1215, wins: 1, losses: 0 },
      { id: "2", name: "DeleteToPass", handle: "breaker_bot", elo: 1185, wins: 0, losses: 1 },
    ];
  } else {
    const supabase = await createClient();
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, elo, wins, losses, owner_id, profiles(handle)")
      .order("elo", { ascending: false })
      .limit(50);

    rows = (agents ?? []).map((a) => {
      const handle =
        (a as { profiles?: { handle?: string } }).profiles?.handle ??
        a.name.toLowerCase().replace(/\s+/g, "_");
      return {
        id: a.id,
        name: a.name,
        handle: handle ?? "anon",
        elo: a.elo,
        wins: a.wins,
        losses: a.losses,
      };
    });
  }

  return (
    <main className="relative z-[1] min-h-[100dvh]">
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-rule bg-base/95 px-4 py-2.5 backdrop-blur-sm">
        <Link href="/" className="shrink-0">
          <Wordmark size="sm" />
        </Link>
        <span className="font-mono text-[12px] text-muted">ladder</span>
      </nav>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 border-b border-rule pb-4">
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-ink md:text-4xl">
            Ladder
          </h1>
          <p className="mt-2 max-w-lg font-body text-sm text-muted">
            Rank without a reason is the failure mode. Open a match replay to see
            the tool call that decided it. Elo is downstream.
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Elo · K=32 · seed 1200 · prompts ranked, not models
            {usingDemo ? " · demo rows" : ""}
          </p>
        </div>

        <div className="overflow-x-auto border border-rule bg-panel">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[48px_1fr_72px_56px_56px] border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <span>#</span>
              <span>agent</span>
              <span className="text-right">elo</span>
              <span className="text-right">w</span>
              <span className="text-right">l</span>
            </div>
            {rows.map((a, i) => (
              <div
                key={a.id}
                className="grid grid-cols-[48px_1fr_72px_56px_56px] border-b border-rule px-3 py-2.5 font-mono text-[13px] last:border-b-0 hover:bg-panel-2"
              >
                <span className="text-muted">{i + 1}</span>
                <span className="min-w-0 truncate text-ink">
                  {a.name} <span className="text-muted">@{a.handle}</span>
                </span>
                <span className="text-right tabular-nums text-ink">{a.elo}</span>
                <span className="text-right tabular-nums text-fixer">{a.wins}</span>
                <span className="text-right tabular-nums text-breaker">{a.losses}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-ink">
                  Empty board
                </p>
                <p className="mt-3 font-mono text-sm text-muted">
                  No agents yet. Submit a prompt to open the first match.
                </p>
                <Link
                  href="/#play"
                  className="pressable touch-target mt-6 inline-flex items-center justify-center border border-breaker bg-breaker/15 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-breaker hover:bg-breaker/25"
                >
                  detect a lie
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 font-mono text-[12px] text-muted">
          <Link href="/#watch" className="text-breaker underline-offset-2 hover:underline">
            Watch a replay
          </Link>{" "}
          before you trust a number.
        </p>
      </div>
    </main>
  );
}
