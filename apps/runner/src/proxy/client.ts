/**
 * Model proxy client. Containers never hold an API key.
 * The runner calls an OpenAI-compatible chat API through this meter;
 * keys stay on the runner host (OpenAI, OpenRouter, Fireworks, NVIDIA NIM, …).
 */
import { TOOL_DEFINITIONS, type ArenaModel } from "@agentarena/shared";
import { config } from "../config.js";
import { apiKeyForProvider, baseUrlForProvider } from "../providers.js";
import { TokenMeter } from "./meter.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ProxyResult {
  message: ChatMessage;
  finishReason: string | null;
  meter: TokenMeter;
}

export interface ModelProxyOpts {
  apiModel?: string;
  baseUrl?: string;
  temperature?: number;
  apiKey?: string;
}

export class ModelProxy {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiModel: string;
  private readonly temperature: number;

  constructor(
    private readonly meter: TokenMeter,
    opts: ModelProxyOpts = {},
  ) {
    this.apiKey = opts.apiKey ?? config.openaiApiKey;
    this.baseUrl = (opts.baseUrl ?? config.openaiBaseUrl).replace(/\/$/, "");
    this.apiModel = opts.apiModel ?? config.model;
    this.temperature = opts.temperature ?? config.temperature;
  }

  static fromArenaModel(meter: TokenMeter, model: ArenaModel): ModelProxy {
    const apiKey = apiKeyForProvider(model.provider);
    if (!apiKey) {
      throw new Error(
        `No API key for provider "${model.provider}". Set the matching env key (OPENAI_API_KEY / NVIDIA_API_KEY / FIREWORKS_API_KEY / OPENROUTER_API_KEY).`,
      );
    }
    return new ModelProxy(meter, {
      apiModel: model.apiModel,
      baseUrl: baseUrlForProvider(model.provider, model.baseUrl),
      temperature: model.temperature,
      apiKey,
    });
  }

  async chat(messages: ChatMessage[]): Promise<ProxyResult> {
    if (this.meter.exhausted) {
      throw new TokenCeilingError(this.meter);
    }

    if (!this.apiKey) {
      throw new Error("Model API key not set for this provider");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    // OpenRouter rankings / optional attribution
    if (this.baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = config.siteUrl;
      headers["X-Title"] = config.siteName;
    }

    // NVIDIA / Llama chat templates reject parallel tool-calls ("single tool-calls at once").
    const safeMessages = serializeSingleToolCalls(messages);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.apiModel,
        temperature: this.temperature,
        messages: safeMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        // Soft stop so the proxy can kill the run when ceiling is hit.
        // Cap soft max — providers with thin credit balances reject huge max_tokens (402).
        max_tokens: Math.min(1024, Math.max(256, this.meter.remaining)),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Model API ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      choices: Array<{
        message: ChatMessage;
        finish_reason: string | null;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const rawUsage = data.usage;
    const promptTokens = rawUsage?.prompt_tokens;
    const completionTokens = rawUsage?.completion_tokens;
    // Fail closed: missing usage would under-count the ceiling and burn spend.
    if (typeof promptTokens !== "number" || typeof completionTokens !== "number") {
      throw new Error("Model response missing usage — fail closed");
    }

    this.meter.record({
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    });

    if (this.meter.exhausted) {
      throw new TokenCeilingError(this.meter);
    }

    const choice = data.choices[0];
    // Keep at most one tool call — parallel calls break Llama NIM templates on the next turn.
    const message = limitAssistantToOneTool(choice.message);
    return {
      message,
      finishReason: choice.finish_reason,
      meter: this.meter,
    };
  }
}

/** Strip parallel tool-calls from history so re-sends don't 500 on Llama templates. */
function serializeSingleToolCalls(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let pendingToolId: string | undefined;
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls?.length) {
      const first = m.tool_calls[0];
      pendingToolId = first.id;
      out.push({
        role: "assistant",
        content: m.content ?? null,
        tool_calls: [first],
      });
      continue;
    }
    if (m.role === "tool") {
      if (pendingToolId && m.tool_call_id === pendingToolId) {
        out.push({
          role: "tool",
          tool_call_id: m.tool_call_id,
          content: m.content ?? "",
        });
        pendingToolId = undefined;
      }
      continue;
    }
    pendingToolId = undefined;
    out.push({
      role: m.role,
      content: m.content ?? (m.role === "assistant" ? null : ""),
      ...(m.name ? { name: m.name } : {}),
    });
  }
  return out;
}

function limitAssistantToOneTool(message: ChatMessage): ChatMessage {
  if (!message.tool_calls || message.tool_calls.length <= 1) {
    return {
      role: "assistant",
      content: message.content ?? null,
      ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
    };
  }
  return {
    role: "assistant",
    content: message.content ?? null,
    tool_calls: [message.tool_calls[0]],
  };
}

export class TokenCeilingError extends Error {
  constructor(public readonly meter: TokenMeter) {
    super(`Token ceiling hit: ${meter.total}/${meter.ceiling}`);
    this.name = "TokenCeilingError";
  }
}
