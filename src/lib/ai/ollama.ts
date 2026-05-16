import { env } from "@/lib/env";
import { fetchProvider, parseMaybeJson, providerErrorMessage } from "@/lib/ai/http";
import { AIProviderError, type AIProvider, type AIRequest, type AIResponse, type AIUsage } from "@/lib/ai/types";

type OllamaResponse = {
  message?: { content?: string };
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  done?: boolean;
};

export class OllamaProvider implements AIProvider {
  name = "ollama" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const baseUrl = (request.baseUrl ?? env.OLLAMA_BASE_URL) || "http://127.0.0.1:11434";
    const apiKey = request.apiKey ?? env.OLLAMA_API_KEY;
    const started = performance.now();
    const response = await fetchProvider(this.name, `${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        format: request.responseSchema ? "json" : undefined,
        options: {
          temperature: request.temperature,
          top_p: request.topP,
          seed: request.seed,
          num_predict: request.maxOutputTokens
        }
      }),
      abortSignal: request.abortSignal
    });

    if (!response.ok) {
      throw await providerErrorMessage(this.name, response);
    }

    const raw = (await response.json()) as OllamaResponse;
    const text = raw.message?.content ?? raw.response ?? "";
    const usage = normalizeOllamaUsage(raw, text, request);

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
      throw new AIProviderError("Ollama returned text that could not be parsed as JSON", this.name);
    }
    return response as AIResponse & { json: T };
  }

  estimateCost(usage?: AIUsage, model?: string): number {
    void usage;
    void model;
    return 0;
  }
}

function normalizeOllamaUsage(raw: OllamaResponse, text: string, request: AIRequest): AIUsage {
  const approximateInput = request.messages.reduce((sum, message) => sum + approximateTokens(message.content), 0);
  const inputTokens = raw.prompt_eval_count ?? approximateInput;
  const outputTokens = raw.eval_count ?? approximateTokens(text);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

function approximateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
