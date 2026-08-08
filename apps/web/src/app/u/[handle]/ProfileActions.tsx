"use client";

import { useState, useTransition } from "react";

export function ProfileActions({
  handle,
  following,
}: {
  handle: string;
  following: boolean;
}) {
  const [isFollowing, setFollowing] = useState(following);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/social/follow", {
              method: isFollowing ? "DELETE" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ handle }),
            });
            if (res.ok) setFollowing(!isFollowing);
            else setNote("follow failed");
          })
        }
        className="pressable border border-rule px-3 py-1.5 uppercase tracking-[0.14em] text-breaker hover:bg-breaker/10"
      >
        {isFollowing ? "unfollow" : "follow"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/social/friends", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ handle, action: "request" }),
            });
            setNote(res.ok ? "friend request sent" : "friend request failed");
          })
        }
        className="pressable border border-rule px-3 py-1.5 uppercase tracking-[0.14em] text-ink hover:bg-panel"
      >
        add friend
      </button>
      <a
        href={`/messages?to=${encodeURIComponent(handle)}`}
        className="pressable border border-rule px-3 py-1.5 uppercase tracking-[0.14em] text-muted hover:text-ink"
      >
        message
      </a>
      {note && <span className="self-center text-muted">{note}</span>}
    </div>
  );
}
