import type { ProviderName } from "@/lib/types";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  provider: ProviderName;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  topP?: number;
  seed?: number;
  maxOutputTokens?: number;
  responseSchema?: unknown;
  apiKey?: string;
  baseUrl?: string;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AIResponse = {
  provider: ProviderName;
  model: string;
  text: string;
  json?: unknown;
  usage: AIUsage;
  latencyMs: number;
  costEstimate: number;
  raw: unknown;
};

export interface AIProvider {
  name: ProviderName;
  generate(request: AIRequest): Promise<AIResponse>;
  generateStructured<T>(request: AIRequest): Promise<AIResponse & { json: T }>;
  estimateCost(usage: AIUsage, model: string): number;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName,
    public readonly status?: number,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
