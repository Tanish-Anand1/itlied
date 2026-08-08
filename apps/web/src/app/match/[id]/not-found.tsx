import Link from "next/link";

export default function MatchNotFound() {
  return (
    <main className="relative z-[1] flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4">
      <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-ink">
        Match not found
      </h1>
      <p className="font-mono text-[12px] text-muted">
        Bad id or the match never existed.
      </p>
      <Link
        href="/"
        className="pressable touch-target inline-flex items-center border border-rule px-4 py-2 font-mono text-[12px] text-breaker hover-border"
      >
        back to arena
      </Link>
    </main>
  );
}
