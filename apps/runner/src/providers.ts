import type { ModelProvider } from "@agentarena/shared";
import { config } from "./config.js";

const PROVIDER_BASE: Record<ModelProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
};

function looksLikeOpenAIKey(key: string): boolean {
  return key.startsWith("sk-") || key.startsWith("sk-proj-");
}

/** Resolve API key for a provider. Never send an NVIDIA/Fireworks key to OpenAI. */
export function apiKeyForProvider(provider: ModelProvider): string {
  switch (provider) {
    case "nvidia":
      return (
        process.env.NVIDIA_API_KEY?.trim() ||
        (config.openaiApiKey.startsWith("nvapi-") ? config.openaiApiKey : "") ||
        ""
      );
    case "fireworks":
      return (
        process.env.FIREWORKS_API_KEY?.trim() ||
        (config.openaiApiKey.startsWith("fw_") ? config.openaiApiKey : "") ||
        ""
      );
    case "openrouter":
      return process.env.OPENROUTER_API_KEY?.trim() || "";
    case "openai":
    default: {
      const k = config.openaiApiKey.trim();
      if (!k || k.startsWith("nvapi-") || k.startsWith("fw_")) return "";
      if (!looksLikeOpenAIKey(k) && process.env.OPENAI_BASE_URL?.includes("nvidia")) {
        return "";
      }
      return looksLikeOpenAIKey(k) ? k : k;
    }
  }
}

export function baseUrlForProvider(
  provider: ModelProvider,
  modelBaseUrl?: string,
): string {
  if (modelBaseUrl?.trim()) return modelBaseUrl.replace(/\/$/, "");
  return PROVIDER_BASE[provider];
}

export function providerStatus(): Record<ModelProvider, boolean> {
  return {
    openai: Boolean(apiKeyForProvider("openai")),
    openrouter: Boolean(apiKeyForProvider("openrouter")),
    fireworks: Boolean(apiKeyForProvider("fireworks")),
    nvidia: Boolean(apiKeyForProvider("nvidia")),
  };
}
