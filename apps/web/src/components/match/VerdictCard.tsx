"use client";

import { DEMO_MATCH_ID } from "@/lib/demo/match";
import { draftConstraintForVerdict, type PackFormat } from "@/lib/promptPack";
import type { MatchEvent } from "@/lib/types";
import { useEffect, useState, useTransition } from "react";

interface Props {
  matchId: string;
  nameA: string;
  nameB: string;
  handleA: string;
  handleB: string;
  verdict: string;
  decidingLine: string;
  durationLabel: string;
  winnerSide: "A" | "B" | null;
  onJumpToDeciding?: () => void;
}

/** Shareable process-monitor verdict strip — blame the agent, not the human handle. */
export function VerdictCard({
  matchId,
  nameA,
  nameB,
  handleA,
  handleB,
  verdict,
  decidingLine,
  durationLabel,
  winnerSide,
  onJumpToDeciding,
}: Props) {
  const shortId = matchId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const [copied, setCopied] = useState<"pack" | "link" | null>(null);
  const [packFormat, setPackFormat] = useState<PackFormat>("cursor");
  const [packText, setPackText] = useState("");
  const [howTo, setHowTo] = useState("");
  const [yourResult, setYourResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isTamper = verdict.includes("TAMPER");
  const reviseHref = `/?revise=${encodeURIComponent(matchId)}#play`;
  const draftConstraint = draftConstraintForVerdict(verdict, decidingLine);

  const loadPack = (format: PackFormat) => {
    setExportError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/matches/${matchId}/prompt-pack?format=${format}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          text?: string;
          howTo?: string;
          yourResult?: string;
          draftConstraint?: string | null;
          error?: string;
        };
        if (!res.ok) {
          setExportError(data.error ?? `export failed (${res.status})`);
          setPackText("");
          return;
        }
        setPackText(data.text ?? "");
        setHowTo(data.howTo ?? "");
        setYourResult(data.yourResult ?? null);
      } catch {
        setExportError("export failed");
      }
    });
  };

  useEffect(() => {
    loadPack(packFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when format/match changes
  }, [matchId, packFormat]);

  const copyLink = async () => {
    const url = `${window.location.origin}/match/${matchId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("link");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const copyPack = async () => {
    setExportError(null);
    if (!packText) {
      setExportError("Pack not loaded — try again");
      return;
    }
    try {
      await navigator.clipboard.writeText(packText);
      setCopied("pack");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setExportError("Clipboard blocked — select the text below and copy manually");
    }
  };

  const downloadPack = () => {
    if (!packText) {
      setExportError("Pack not loaded — try again");
      return;
    }
    const filename =
      packFormat === "cursor"
        ? "itlied-coding.mdc"
        : packFormat === "claude"
          ? "CLAUDE.md"
          : "itlied-prompt.txt";
    const blob = new Blob([packText], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  };

  const resultLabel =
    yourResult === "won"
      ? "your prompt beat house baseline"
      : yourResult === "lost"
        ? "house baseline beat your prompt"
        : yourResult === "tampered"
          ? "your agent tampered — draft constraint below"
          : yourResult === "timeout"
            ? "your prompt did not finish — draft constraint below"
            : null;

  return (
    <div className="verdict-enter space-y-4">
      <div
        id="verdict-card"
        className="relative w-full max-w-[1200px] overflow-hidden border border-rule bg-panel"
        style={{ aspectRatio: "1200 / 630" }}
      >
        <div className="relative flex h-full flex-col justify-between p-6 md:p-10">
          <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted md:text-[12px]">
              <span className="text-breaker">&gt;_</span> ItLied · match {shortId}
            </div>
            <div className="font-mono text-[12px] text-muted">{durationLabel}</div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
            <div className="text-left">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-breaker">
                YOUR PROMPT
              </div>
              <div className="mt-1 font-mono text-xl font-semibold uppercase tracking-[0.06em] text-ink md:text-3xl">
                {nameA}
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted">@{handleA}</div>
              {winnerSide === "A" && (
                <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-breaker">
                  proven
                </div>
              )}
            </div>
            <div className="font-mono text-lg uppercase tracking-[0.2em] text-muted md:text-2xl">
              vs
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fixer">
                HOUSE BASELINE
              </div>
              <div className="mt-1 font-mono text-xl font-semibold uppercase tracking-[0.06em] text-ink md:text-3xl">
                {nameB}
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted">@{handleB}</div>
              {winnerSide === "B" && (
                <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-fixer">
                  baseline wins
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-rule pt-4">
            <div
              className={`font-mono text-xl font-semibold uppercase tracking-[0.12em] md:text-3xl ${
                isTamper ? "text-verdict" : "text-ink"
              }`}
            >
              {verdict.replace(/_/g, " ")}
            </div>
            <div className="mt-2 max-w-3xl font-mono text-[12px] text-muted md:text-sm">
              {decidingLine || "Hidden suite decided the match."}
            </div>
            {resultLabel && (
              <div className="mt-2 font-mono text-[11px] text-breaker">{resultLabel}</div>
            )}
          </div>
        </div>
      </div>

      {yourResult && yourResult !== "won" && draftConstraint && (
        <div
          className={`border px-3 py-3 font-mono text-[12px] ${
            isTamper
              ? "border-verdict/40 bg-verdict/10 text-verdict"
              : "border-rule bg-panel text-muted"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
            why it matters · add this before you prove again
          </p>
          <p className="mt-1 text-ink">{decidingLine || verdict}</p>
          <p className="mt-2 text-breaker">{draftConstraint}</p>
        </div>
      )}

      <div className="border border-rule bg-panel p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              export your prompt pack
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              Same bug · house uses a fixed baseline prompt · you prove yours
            </p>
          </div>
          <div className="flex border border-rule font-mono text-[10px] uppercase tracking-[0.12em]">
            {(["cursor", "claude", "raw"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPackFormat(f)}
                className={`px-2 py-1 ${
                  packFormat === f
                    ? "bg-breaker/10 text-breaker"
                    : "text-muted hover:text-ink"
                } ${f !== "cursor" ? "border-l border-rule" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {howTo && (
          <p className="mt-3 font-mono text-[11px] text-fixer">{howTo}</p>
        )}

        <textarea
          readOnly
          value={pending && !packText ? "loading pack…" : packText}
          rows={8}
          className="mt-3 w-full resize-y border border-rule bg-base px-3 py-2 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-breaker"
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Prompt pack text"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <button
            type="button"
            disabled={pending || !packText}
            onClick={() => void copyPack()}
            className="pressable touch-target inline-flex items-center border border-breaker bg-breaker/15 px-4 py-2.5 font-semibold uppercase tracking-[0.16em] text-breaker hover:bg-breaker/25 disabled:opacity-40"
          >
            {copied === "pack" ? "copied" : "copy pack"}
          </button>
          <button
            type="button"
            disabled={pending || !packText}
            onClick={downloadPack}
            className="pressable touch-target border border-rule px-3 py-2 text-ink hover-border disabled:opacity-40"
          >
            {packFormat === "cursor"
              ? "download .mdc"
              : packFormat === "claude"
                ? "download CLAUDE.md"
                : "download .txt"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => loadPack(packFormat)}
            className="pressable text-muted hover:text-breaker"
          >
            reload
          </button>
        </div>
        {exportError && (
          <p className="mt-2 font-mono text-[11px] text-verdict" role="alert">
            {exportError}
          </p>
        )}
        <p className="mt-3 border-t border-rule pt-3 font-mono text-[11px] text-muted">
          Daily loop: paste into Cursor/Claude → code → if the agent lies or
          stalls, come back tomorrow (or now), revise, prove again.{" "}
          <a href="/me" className="text-breaker hover:underline">
            open daily →
          </a>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <a
          href={`/lie/${matchId === DEMO_MATCH_ID || matchId === "demo" ? "demo" : matchId}`}
          className="pressable touch-target inline-flex items-center border border-verdict/50 bg-verdict/10 px-4 py-2.5 font-semibold uppercase tracking-[0.16em] text-verdict hover:bg-verdict/20"
        >
          share lie card →
        </a>
        <a
          href={`/cinema/${matchId === DEMO_MATCH_ID || matchId === "demo" ? "demo" : matchId}`}
          className="pressable touch-target inline-flex items-center border border-breaker/40 px-3 py-2 text-breaker hover:border-breaker"
        >
          cinema →
        </a>
        <a
          href={reviseHref}
          className="pressable touch-target inline-flex items-center border border-rule px-3 py-2 text-ink hover-border"
        >
          Revise &amp; prove again
        </a>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="pressable touch-target border border-rule px-3 py-2 text-ink hover-border"
        >
          {copied === "link" ? "link copied" : "copy match link"}
        </button>
        {onJumpToDeciding && decidingLine && (
          <button
            type="button"
            onClick={onJumpToDeciding}
            className="pressable touch-target border border-fixer/40 px-3 py-2 text-fixer hover:border-fixer"
          >
            jump to deciding call
          </button>
        )}
      </div>
    </div>
  );
}

export function verdictFromEvents(events: MatchEvent[]): {
  verdict: string;
  decidingLine: string;
  durationMs: number;
  winnerId: string | null;
  decidingSeq: number | null;
} | null {
  const v = [...events].reverse().find((e) => e.type === "verdict");
  if (!v) return null;
  const decidingLine = String(v.payload.deciding_line ?? v.payload.reason ?? "");
  const before = [...events]
    .filter((e) => e.seq < v.seq)
    .reverse()
    .find((e) => e.type === "tamper" || e.type === "tool_call" || e.type === "test_run");
  return {
    verdict: String(v.payload.verdict ?? "FINISHED"),
    decidingLine,
    durationMs: Number(v.payload.duration_ms ?? 0),
    winnerId: (v.payload.winner_id as string | null) ?? null,
    decidingSeq: before?.seq ?? null,
  };
}
