"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";

type OpsData = {
  spend: {
    day: string;
    spend_cents: number;
    reserved_cents: number;
    kill_switch: boolean;
  };
  matches_today: number;
  fixtures: Array<{ id: string; name: string; difficulty: string }>;
  seasons: Array<{ id: string; name: string; elo_epoch: number }>;
};

export default function OpsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tName, setTName] = useState("Weekend Cup");

  const load = () => {
    start(async () => {
      const res = await fetch("/api/ops");
      if (res.status === 403 || res.status === 401) {
        setError("ops role required");
        return;
      }
      const json = (await res.json()) as OpsData;
      setData(json);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const toggleKill = () => {
    if (!data) return;
    start(async () => {
      await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kill_switch: !data.spend.kill_switch }),
      });
      load();
    });
  };

  const createTournament = () => {
    if (!data?.seasons[0]) return;
    start(async () => {
      await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: tName,
          season_id: data.seasons[0].id,
          fixture_id: data.fixtures[0]?.id ?? "async-race",
          bracket_size: 8,
        }),
      });
      load();
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        process monitor · ops
      </p>
      <h1 className="mt-1 font-display text-3xl text-ink">Ops</h1>
      <p className="mt-2 font-mono text-[12px]">
        <Link href="/" className="text-muted hover:text-ink">
          ← home
        </Link>
      </p>

      {error && (
        <p className="mt-6 font-mono text-[12px] text-breaker" role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-0 border border-rule font-mono text-[12px] sm:grid-cols-2">
            <div className="border-b border-rule px-3 py-3 sm:border-b-0 sm:border-r">
              <p className="text-muted">day {data.spend.day}</p>
              <p className="mt-1 text-ink">
                spend {data.spend.spend_cents}¢ · reserved{" "}
                {data.spend.reserved_cents}¢
              </p>
              <p className="mt-1 text-muted">matches today {data.matches_today}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-muted">kill switch</p>
              <button
                type="button"
                disabled={pending}
                onClick={toggleKill}
                className={`pressable mt-2 border px-3 py-1.5 uppercase tracking-[0.14em] ${
                  data.spend.kill_switch
                    ? "border-verdict text-verdict"
                    : "border-fixer text-fixer"
                }`}
              >
                {data.spend.kill_switch ? "armed · click to clear" : "clear · click to arm"}
              </button>
            </div>
          </div>

          <section className="mt-6 border border-rule">
            <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              fixtures
            </h2>
            <ul className="divide-y divide-rule font-mono text-[12px]">
              {data.fixtures.map((f) => (
                <li key={f.id} className="flex justify-between px-3 py-2">
                  <span>{f.name}</span>
                  <span className="text-muted">{f.difficulty}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 border border-rule p-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              create tournament
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                className="flex-1 border border-rule bg-transparent px-2 py-1.5 font-mono text-[12px] text-ink"
              />
              <button
                type="button"
                disabled={pending}
                onClick={createTournament}
                className="pressable border border-breaker/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker"
              >
                create draft
              </button>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted">
              Then open + advance via API ·{" "}
              <Link href="/seasons" className="text-breaker hover:underline">
                seasons
              </Link>
            </p>
          </section>
        </>
      )}
    </main>
  );
}
