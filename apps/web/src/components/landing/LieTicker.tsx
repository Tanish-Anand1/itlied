"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  label: string;
  headline: string;
  fixture: string;
  handle: string;
  at: string;
};

function colorFor(label: string): string {
  if (label === "CLEARED") return "text-fixer";
  if (label === "IT_LIED" || label === "TAMPER") return "text-verdict";
  return "text-muted";
}

/** Global addiction loop — everyone else's proves scroll by. */
export function LieTicker() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch("/api/lies", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: Item[] };
        if (!dead) setItems(data.items ?? []);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 8000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, []);

  if (!items.length) return null;

  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-rule bg-panel">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="shrink-0 border border-verdict/40 bg-verdict/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-verdict">
          live lies
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="lie-ticker-track flex w-max gap-6 font-mono text-[11px]">
            {loop.map((it, i) => (
              <Link
                key={`${it.id}-${i}`}
                href={`/lie/${it.id}`}
                className="shrink-0 hover:underline"
              >
                <span className={colorFor(it.label)}>{it.headline}</span>
                <span className="text-muted">
                  {" "}
                  · @{it.handle} · {it.fixture}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
