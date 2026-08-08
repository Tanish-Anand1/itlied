"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles?: { handle?: string } | null;
};

export function MatchComments({ matchId }: { matchId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    start(async () => {
      const res = await fetch(`/api/social/comments?match_id=${matchId}`);
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments ?? []);
    });
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_comments",
          filter: `match_id=eq.${matchId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  const post = () => {
    if (!text.trim()) return;
    start(async () => {
      setError(null);
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, body: text }),
      });
      if (res.status === 401) {
        setError("sign in to comment");
        return;
      }
      if (!res.ok) {
        setError("failed");
        return;
      }
      setText("");
      load();
    });
  };

  return (
    <section className="border-t border-rule">
      <div className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        comments · {comments.length}
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto p-3 font-mono text-[12px]">
        {comments.map((c) => (
          <li key={c.id} className="border border-rule bg-panel px-3 py-2">
            <p className="text-[10px] text-muted">
              @{c.profiles?.handle ?? c.author_id.slice(0, 6)}
            </p>
            <p className="mt-1 text-ink">{c.body}</p>
          </li>
        ))}
        {!comments.length && <li className="text-muted">no comments yet</li>}
      </ul>
      <div className="flex gap-2 border-t border-rule p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="say something about the verdict…"
          className="flex-1 border border-rule bg-transparent px-3 py-2 font-mono text-[12px] text-ink"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={post}
          className="pressable border border-breaker/40 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-breaker"
        >
          post
        </button>
      </div>
      {error && (
        <p className="px-3 pb-2 font-mono text-[11px] text-breaker">{error}</p>
      )}
    </section>
  );
}
