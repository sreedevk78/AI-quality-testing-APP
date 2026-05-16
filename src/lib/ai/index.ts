import { GeminiProvider } from "@/lib/ai/gemini";
import { GroqProvider } from "@/lib/ai/groq";
import { OllamaProvider } from "@/lib/ai/ollama";
import type { AIProvider } from "@/lib/ai/types";
import type { ProviderName } from "@/lib/types";

export const providers: Record<ProviderName, AIProvider> = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider(),
  ollama: new OllamaProvider()
};

export function getProvider(name: ProviderName) {
  return providers[name];
}
