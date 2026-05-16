import { env } from "@/lib/env";
import { fetchProvider, parseMaybeJson, providerErrorMessage } from "@/lib/ai/http";
import { AIProviderError, type AIProvider, type AIRequest, type AIResponse, type AIUsage } from "@/lib/ai/types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiProvider implements AIProvider {
  name = "gemini" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = request.apiKey ?? env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError("GEMINI_API_KEY is not configured", this.name);
    }

    const started = performance.now();
    const system = request.messages.find((message) => message.role === "system")?.content;
    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }));

    const body = {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: request.temperature,
        topP: request.topP,
        maxOutputTokens: request.maxOutputTokens,
        responseMimeType: request.responseSchema ? "application/json" : undefined,
        responseSchema: request.responseSchema
      }
    };

    const response = await fetchProvider(
      this.name,
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        abortSignal: request.abortSignal
      }
    );

    if (!response.ok) {
      throw await providerErrorMessage(this.name, response);
    }

    const raw = (await response.json()) as GeminiResponse;
    const text = raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const usage = normalizeGeminiUsage(raw);
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
      throw new AIProviderError("Gemini returned text that could not be parsed as JSON", this.name);
    }
    return response as AIResponse & { json: T };
  }

  estimateCost(usage: AIUsage, model: string): number {
    const rate = model.includes("pro") ? 0.0000035 : 0.00000035;
    return Number((usage.totalTokens * rate).toFixed(6));
  }
}

function normalizeGeminiUsage(raw: GeminiResponse): AIUsage {
  const inputTokens = raw.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = raw.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: raw.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens
  };
}
