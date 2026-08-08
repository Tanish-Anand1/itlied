"use client";

import { REUSE_PROMPT_KEY } from "@/components/me/ReusePromptButton";
import { useRouter } from "next/navigation";

const FIXTURE_KEY = "itlied_daily_fixture";

export function ProveTodayButton({
  prompt,
  fixtureId,
  label = "prove today →",
  className = "pressable border border-breaker bg-breaker/15 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-breaker hover:bg-breaker/25",
}: {
  prompt: string;
  fixtureId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          if (prompt.trim().length >= 20) {
            sessionStorage.setItem(REUSE_PROMPT_KEY, prompt);
          }
          sessionStorage.setItem(FIXTURE_KEY, fixtureId);
        } catch {
          /* ignore */
        }
        router.push("/#play");
      }}
    >
      {label}
    </button>
  );
}

export function readDailyFixture(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(FIXTURE_KEY);
    sessionStorage.removeItem(FIXTURE_KEY);
    return v;
  } catch {
    return null;
  }
}
