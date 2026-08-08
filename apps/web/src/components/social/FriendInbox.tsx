"use client";

import { useEffect, useState, useTransition } from "react";

type Pending = {
  id: string;
  requester_id: string;
  profiles?: { handle?: string; display_name?: string } | null;
};

export function FriendInbox() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, start] = useTransition();

  const load = () => {
    start(async () => {
      const res = await fetch("/api/social/friends");
      if (!res.ok) return;
      const data = (await res.json()) as { pending: Pending[] };
      setPending(data.pending ?? []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  if (!pending.length) return null;

  return (
    <section className="mt-6 border border-rule">
      <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        friend requests
      </h2>
      <ul className="divide-y divide-rule font-mono text-[12px]">
        {pending.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-3 py-2">
            <span>@{p.profiles?.handle ?? p.requester_id.slice(0, 6)}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  await fetch("/api/social/friends", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      handle: p.profiles?.handle,
                      action: "accept",
                    }),
                  });
                  load();
                })
              }
              className="pressable border border-fixer/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-fixer"
            >
              accept
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
