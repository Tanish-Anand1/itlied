"use client";

import { useRouter } from "next/navigation";

export const REUSE_PROMPT_KEY = "itlied_reuse_prompt";

export function ReusePromptButton({ prompt }: { prompt: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-breaker hover:underline"
      onClick={() => {
        try {
          sessionStorage.setItem(REUSE_PROMPT_KEY, prompt);
        } catch {
          /* ignore quota */
        }
        router.push("/?reuse=1#play");
      }}
    >
      reuse → prove
    </button>
  );
}

export function readReusePrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = sessionStorage.getItem(REUSE_PROMPT_KEY) ?? "";
    sessionStorage.removeItem(REUSE_PROMPT_KEY);
    return v;
  } catch {
    return "";
  }
}
