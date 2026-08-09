"use client";

import { extractRulesBody } from "@/lib/lies";
import { useCallback, useRef, useState, useTransition } from "react";

/** Drop real Cursor/Claude rules — file, clipboard, or GitHub URL. */
export function RulesDrop({
  onRules,
}: {
  onRules: (body: string, source: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hot, setHot] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  const ingest = useCallback(
    async (file: File | null, pasted?: string) => {
      setNote(null);
      try {
        const raw = pasted ?? (file ? await file.text() : "");
        const body = extractRulesBody(raw);
        if (body.length < 20) {
          setNote("Need at least 20 chars of rules.");
          return;
        }
        const source = file?.name ?? "paste";
        onRules(body, source);
        setNote(`loaded ${source} · ${body.length} chars · hit detect`);
      } catch {
        setNote("Could not read file.");
      }
    },
    [onRules],
  );

  const fetchUrl = () => {
    const u = url.trim();
    if (!u) return;
    setNote(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rules/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u }),
        });
        const data = (await res.json()) as {
          rules?: string;
          source?: string;
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.rules) {
          setNote(data.message ?? data.error ?? "fetch failed");
          return;
        }
        onRules(data.rules, data.source ?? u);
        setNote(`pulled ${data.rules.length} chars from GitHub · hit detect`);
      } catch {
        setNote("fetch failed");
      }
    });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHot(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        void ingest(file);
      }}
      className={`border px-3 py-3 font-mono text-[12px] transition-colors ${
        hot
          ? "border-breaker bg-breaker/15 text-breaker"
          : "border-rule bg-panel text-muted"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink">Drop a rules file, or pull a public GitHub URL.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="pressable border border-breaker/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-breaker hover:bg-breaker/10"
          >
            file
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                void ingest(null, text);
              } catch {
                setNote("Clipboard blocked — paste into the prompt.");
              }
            }}
            className="pressable border border-rule px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink hover:border-breaker/40"
          >
            clipboard
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/you/repo/blob/main/CLAUDE.md"
          className="min-w-0 flex-1 border border-rule bg-base px-3 py-2 text-[11px] text-ink outline-none focus:border-breaker"
        />
        <button
          type="button"
          disabled={pending || url.trim().length < 12}
          onClick={fetchUrl}
          className="pressable border border-verdict/40 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-verdict disabled:opacity-40"
        >
          {pending ? "pulling…" : "pull url"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".md,.mdc,.txt,.markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void ingest(file);
          e.target.value = "";
        }}
      />
      {note && <p className="mt-2 text-breaker">{note}</p>}
    </div>
  );
}
