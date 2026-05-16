import { env } from "@/lib/env";
import { fetchProvider, parseMaybeJson, providerErrorMessage } from "@/lib/ai/http";
import { AIProviderError, type AIProvider, type AIRequest, type AIResponse, type AIUsage } from "@/lib/ai/types";

type GroqChoice = {
  message?: { content?: string };
};

type GroqResponse = {
  choices?: GroqChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export class GroqProvider implements AIProvider {
  name = "groq" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = request.apiKey ?? env.GROQ_API_KEY;
    if (!apiKey) {
      throw new AIProviderError("GROQ_API_KEY is not configured", this.name);
    }

    const started = performance.now();
    const body = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      top_p: request.topP,
      seed: request.seed,
      max_completion_tokens: request.maxOutputTokens,
      response_format: request.responseSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: "evaluation_response",
              schema: request.responseSchema
            }
          }
        : undefined
    };

    const response = await fetchProvider(this.name, "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      abortSignal: request.abortSignal
    });

    if (!response.ok) {
      throw await providerErrorMessage(this.name, response);
    }

    const raw = (await response.json()) as GroqResponse;
    const text = raw.choices?.[0]?.message?.content ?? "";
    const usage = normalizeGroqUsage(raw);
    return {
      provider: this.name,
      model: request.model,
      text,
      json: parseMaybeJson(text),
      usage,
      latencyMs: Math.round(performance.now() - started),
      costEstimate: this.estimateCost(usage, request.model),
      raw
    };
  }

  async generateStructured<T>(request: AIRequest): Promise<AIResponse & { json: T }> {
    const response = await this.generate(request);
    if (!response.json) {
      throw new AIProviderError("Groq returned text that could not be parsed as JSON", this.name);
    }
    return response as AIResponse & { json: T };
  }

  estimateCost(usage: AIUsage, model: string): number {
    const rate = model.includes("70b") ? 0.00000079 : 0.0000001;
    return Number((usage.totalTokens * rate).toFixed(6));
  }
}

function normalizeGroqUsage(raw: GroqResponse): AIUsage {
  const inputTokens = raw.usage?.prompt_tokens ?? 0;
  const outputTokens = raw.usage?.completion_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: raw.usage?.total_tokens ?? inputTokens + outputTokens
  };
}
