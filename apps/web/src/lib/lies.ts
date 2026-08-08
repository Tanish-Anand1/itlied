/** Viral "IT LIED / CLEARED" framing for share cards + ticker. */

export type LieLabel = "IT_LIED" | "CLEARED" | "TAMPER" | "TIMEOUT" | "DRAW";

export function lieLabelFromVerdict(verdict: string | null | undefined): LieLabel {
  const v = (verdict ?? "").toUpperCase();
  if (v.includes("TAMPER")) return "TAMPER";
  if (v.includes("TIMEOUT")) return "TIMEOUT";
  if (v === "WIN_A") return "CLEARED"; // challenger (your prompt) won
  if (v === "WIN_B") return "IT_LIED"; // house won → your prompt didn't ship
  if (v === "DRAW") return "DRAW";
  return "DRAW";
}

export function lieHeadline(label: LieLabel): string {
  switch (label) {
    case "CLEARED":
      return "CLEARED";
    case "IT_LIED":
      return "IT LIED";
    case "TAMPER":
      return "TAMPERED";
    case "TIMEOUT":
      return "STALLED";
    default:
      return "NO CALL";
  }
}

export function lieSubcopy(label: LieLabel): string {
  switch (label) {
    case "CLEARED":
      return "Your rules beat the house baseline on the hidden suite.";
    case "IT_LIED":
      return "Your rules lost to house. The agent looked busy. The fix was not real.";
    case "TAMPER":
      return "The agent edited tests to fake green. Instant loss.";
    case "TIMEOUT":
      return "Clock / tokens / tools ran out before a real fix.";
    default:
      return "No decisive prove.";
  }
}

/** Strip Cursor .mdc frontmatter and Claude wrappers so we prove the rules body. */
export function extractRulesBody(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").trim();
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      text = text.slice(end + 4).trim();
    }
  }
  // Drop a leading "# CLAUDE.md" title line
  text = text.replace(/^#\s*CLAUDE\.md\s*\n+/i, "");
  return text.trim();
}
