import { MODEL_PRICING } from "@agentarena/shared";

export class TokenMeter {
  inputTokens = 0;
  outputTokens = 0;

  constructor(public readonly ceiling: number) {}

  get total(): number {
    return this.inputTokens + this.outputTokens;
  }

  get remaining(): number {
    return Math.max(0, this.ceiling - this.total);
  }

  get exhausted(): boolean {
    return this.total >= this.ceiling;
  }

  record(usage: { prompt_tokens: number; completion_tokens: number }): void {
    if (
      typeof usage.prompt_tokens !== "number" ||
      typeof usage.completion_tokens !== "number" ||
      usage.prompt_tokens < 0 ||
      usage.completion_tokens < 0
    ) {
      throw new Error("TokenMeter refused invalid usage");
    }
    this.inputTokens += usage.prompt_tokens;
    this.outputTokens += usage.completion_tokens;
  }

  costCents(): number {
    const usd =
      (this.inputTokens / 1_000_000) * MODEL_PRICING.inputPerMillionUsd +
      (this.outputTokens / 1_000_000) * MODEL_PRICING.outputPerMillionUsd;
    return Math.ceil(usd * 100);
  }
}
