"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Conv = {
  id: string;
  members: Array<{
    profile_id: string;
    profiles?: { handle?: string; display_name?: string } | null;
  }>;
};

type Msg = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export default function MessagesPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [toHandle, setToHandle] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    start(async () => {
      const res = await fetch("/api/social/messages");
      if (res.status === 401) {
        window.location.href = "/login?next=/messages";
        return;
      }
      const data = (await res.json()) as { conversations: Conv[] };
      setConvs(data.conversations ?? []);
    });
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (to) setToHandle(to);
  }, []);

  useEffect(() => {
    if (!active) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", active)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as Msg[]) ?? []);
    })();

    const channel = supabase
      .channel(`dm:${active}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${active}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Msg]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active]);

  const openWith = () => {
    start(async () => {
      setError(null);
      const res = await fetch("/api/social/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: toHandle }),
      });
      const data = (await res.json()) as { conversation_id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "failed");
        return;
      }
      if (data.conversation_id) {
        setActive(data.conversation_id);
        load();
      }
    });
  };

  const send = () => {
    if (!active || !text.trim()) return;
    start(async () => {
      const res = await fetch("/api/social/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: active, message: text }),
      });
      if (res.ok) setText("");
    });
  };

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-5xl gap-0 border-x border-rule md:grid-cols-[240px_1fr]">
      <aside className="border-r border-rule bg-panel">
        <div className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          conversations
        </div>
        <div className="border-b border-rule p-2">
          <input
            value={toHandle}
            onChange={(e) => setToHandle(e.target.value)}
            placeholder="handle"
            className="w-full border border-rule bg-transparent px-2 py-1.5 font-mono text-[12px] text-ink"
          />
          <button
            type="button"
            disabled={pending || !toHandle.trim()}
            onClick={openWith}
            className="pressable mt-2 w-full border border-breaker/40 px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker"
          >
            open dm
          </button>
          {error && <p className="mt-1 font-mono text-[11px] text-breaker">{error}</p>}
        </div>
        <ul className="font-mono text-[12px]">
          {convs.map((c) => {
            const other = c.members[0]?.profiles?.handle ?? "user";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-base ${
                    active === c.id ? "bg-base text-breaker" : "text-ink"
                  }`}
                >
                  @{other}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-3 py-3 font-mono text-[11px] text-muted">
          <Link href="/" className="hover:text-ink">
            ← home
          </Link>
        </p>
      </aside>
      <section className="flex flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-4 font-mono text-[12px]">
          {!active && <p className="text-muted">select or open a conversation</p>}
          {messages.map((m) => (
            <div key={m.id} className="border border-rule bg-panel px-3 py-2">
              <p className="text-[10px] text-muted">{m.created_at}</p>
              <p className="mt-1 text-ink">{m.body}</p>
            </div>
          ))}
        </div>
        {active && (
          <div className="flex gap-2 border-t border-rule p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              className="flex-1 border border-rule bg-transparent px-3 py-2 font-mono text-[12px] text-ink"
              placeholder="message…"
            />
            <button
              type="button"
              disabled={pending || !text.trim()}
              onClick={send}
              className="pressable border border-breaker/40 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker"
            >
              send
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
