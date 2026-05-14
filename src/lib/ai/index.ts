import { GeminiProvider } from "@/lib/ai/gemini";
import { GroqProvider } from "@/lib/ai/groq";
import type { AIProvider } from "@/lib/ai/types";
import type { ProviderName } from "@/lib/types";

export const providers: Record<ProviderName, AIProvider> = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider()
};

export function getProvider(name: ProviderName) {
  return providers[name];
}
