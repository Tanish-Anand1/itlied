/** Allowlisted models — runner rejects anything else. */
export type ModelProvider = "openai" | "openrouter" | "fireworks" | "nvidia";

export interface ArenaModel {
  id: string;
  label: string;
  provider: ModelProvider;
  /** OpenAI-compatible model string sent to the API */
  apiModel: string;
  /** Optional base URL override; else env OPENAI_BASE_URL */
  baseUrl?: string;
  temperature: number;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  tokenCeiling: number;
  supportsTools: boolean;
  enabled: boolean;
}

export const MODEL_ALLOWLIST: readonly ArenaModel[] = [
  {
    id: "fireworks/deepseek-v4-flash",
    label: "DeepSeek V4 Flash (Fireworks)",
    provider: "fireworks",
    apiModel: "accounts/fireworks/models/deepseek-v4-flash",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    temperature: 0.2,
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
  {
    id: "fireworks/gpt-oss-120b",
    label: "GPT-OSS 120B (Fireworks)",
    provider: "fireworks",
    apiModel: "accounts/fireworks/models/gpt-oss-120b",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    temperature: 0.2,
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
  {
    id: "nvidia/llama-3.1-8b-instruct",
    label: "Llama 3.1 8B (NVIDIA)",
    provider: "nvidia",
    apiModel: "meta/llama-3.1-8b-instruct",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    temperature: 0.2,
    inputPerMillionUsd: 0,
    outputPerMillionUsd: 0,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
  {
    id: "openai/gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    provider: "openai",
    apiModel: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    temperature: 0.2,
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    apiModel: "gpt-4.1",
    baseUrl: "https://api.openai.com/v1",
    temperature: 0.2,
    inputPerMillionUsd: 2.0,
    outputPerMillionUsd: 8.0,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
  {
    id: "openrouter/gpt-4.1-mini",
    label: "GPT-4.1 Mini (OpenRouter)",
    provider: "openrouter",
    apiModel: "openai/gpt-4.1-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    temperature: 0.2,
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
    tokenCeiling: 80_000,
    supportsTools: true,
    enabled: true,
  },
] as const;

/** Prefer Fireworks locally — OpenAI keys are often mis-set to NVIDIA NIM. */
export const DEFAULT_MODEL_ID = "fireworks/deepseek-v4-flash";

export function getModel(id: string): ArenaModel | undefined {
  return MODEL_ALLOWLIST.find((m) => m.id === id && m.enabled);
}

export function assertModel(id: string): ArenaModel {
  const m = getModel(id);
  if (!m) throw new Error(`Model not allowlisted: ${id}`);
  return m;
}

/** Worst-case cents for one match (both agents at ceiling, 75/25 in/out). */
export function ceilingCostCentsForModel(model: ArenaModel): number {
  const tokens = model.tokenCeiling * 2;
  const inTok = tokens * 0.75;
  const outTok = tokens * 0.25;
  const usd =
    (inTok / 1_000_000) * model.inputPerMillionUsd +
    (outTok / 1_000_000) * model.outputPerMillionUsd;
  return Math.max(1, Math.ceil(usd * 100));
}
