import {
  DAILY_BUDGET_CENTS,
  MATCH_LIMITS,
  MODEL_PRICING,
} from "@agentarena/shared";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

/** Load repo-root .env into process.env without overriding existing vars. */
function loadRootEnv(): void {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadRootEnv();

export const config = {
  port: Number(process.env.RUNNER_PORT ?? 8080),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** OpenAI-compatible base, e.g. https://openrouter.ai/api/v1 */
  openaiBaseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  ),
  model: process.env.ARENA_MODEL ?? MODEL_PRICING.model,
  temperature: MODEL_PRICING.temperature,
  dailyBudgetCents: Number(process.env.DAILY_BUDGET_CENTS ?? DAILY_BUDGET_CENTS),
  tokenCeiling: Number(process.env.TOKEN_CEILING ?? MATCH_LIMITS.tokens),
  /** Default fixture root (smoke / fallback). Live matches use fixturePath(id). */
  fixtureRoot: path.join(repoRoot, "fixtures", "async-race"),
  fixturesDir: path.join(repoRoot, "fixtures"),
  sandboxImage: process.env.SANDBOX_IMAGE ?? "agentarena-sandbox:v1",
  proxyPort: Number(process.env.PROXY_PORT ?? 8090),
  /** Host path visible to Docker for binding fixture workdirs */
  workRoot: process.env.WORK_ROOT ?? path.join(repoRoot, ".arena-work"),
  dryRun: process.env.DRY_RUN === "1",
  /** Shared with apps/web — required to start matches when set */
  sharedSecret: process.env.RUNNER_SHARED_SECRET ?? "",
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  siteName: process.env.SITE_NAME ?? "ItLied",
  repoRoot,
};

/** Resolve on-disk fixture pack. Rejects path traversal. */
export function fixturePath(fixtureId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(fixtureId)) {
    throw new Error(`Invalid fixture id: ${fixtureId}`);
  }
  const root = path.join(config.fixturesDir, fixtureId);
  const resolved = path.resolve(root);
  const base = path.resolve(config.fixturesDir);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Fixture path escape: ${fixtureId}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Fixture not on disk: ${fixtureId}`);
  }
  return resolved;
}
