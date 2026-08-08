"use client";

import { useState, useTransition } from "react";

export function ClipExport({ matchId }: { matchId: string }) {
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(20);
  const [status, setStatus] = useState<string | null>(null);
  const [clipId, setClipId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  const exportClip = () => {
    startTx(async () => {
      setStatus(null);
      setUrl(null);
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          start_seq: start,
          end_seq: end,
        }),
      });
      const data = (await res.json()) as {
        clip?: { id: string; status: string };
        error?: string;
      };
      if (!res.ok) {
        setStatus(data.error ?? "export failed");
        return;
      }
      setClipId(data.clip?.id ?? null);
      setStatus(data.clip?.status ?? "queued");
    });
  };

  const refresh = () => {
    if (!clipId) return;
    startTx(async () => {
      const res = await fetch(`/api/clips?id=${clipId}`);
      const data = (await res.json()) as {
        clip?: { status: string; storage_path?: string };
        url?: string | null;
      };
      setStatus(data.clip?.status ?? null);
      if (data.url) setUrl(data.url);
      else if (data.clip?.storage_path?.startsWith("local:")) {
        setUrl(null);
        setStatus(`${data.clip.status} · ${data.clip.storage_path}`);
      }
    });
  };

  return (
    <section className="border-t border-rule px-3 py-3 font-mono text-[12px]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
        export clip · hand-pick seq
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted">start</span>
          <input
            type="number"
            min={1}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="w-20 border border-rule bg-transparent px-2 py-1 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted">end</span>
          <input
            type="number"
            min={1}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="w-20 border border-rule bg-transparent px-2 py-1 text-ink"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={exportClip}
          className="pressable border border-breaker/40 px-3 py-1.5 uppercase tracking-[0.14em] text-breaker"
        >
          export
        </button>
        {clipId && (
          <button
            type="button"
            disabled={pending}
            onClick={refresh}
            className="pressable border border-rule px-3 py-1.5 uppercase tracking-[0.14em] text-muted"
          >
            refresh
          </button>
        )}
      </div>
      {status && <p className="mt-2 text-muted">{status}</p>}
      {url && (
        <a href={url} className="mt-1 inline-block text-breaker hover:underline" target="_blank" rel="noreferrer">
          download clip →
        </a>
      )}
    </section>
  );
}
