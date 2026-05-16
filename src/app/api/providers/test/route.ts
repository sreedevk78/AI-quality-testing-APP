import { z } from "zod";
import { getProvider } from "@/lib/ai";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";

const testProviderSchema = z.object({
  provider: z.enum(["gemini", "groq", "ollama"]).default("groq"),
  model: z.string().min(2).optional(),
  prompt: z.string().min(1).max(20_000).optional()
});

const credentials = new ProviderCredentialService();
const defaultModels = {
  groq: "llama-3.1-8b-instant",
  gemini: "gemini-2.5-flash",
  ollama: "llama3.1"
} as const;

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const body = testProviderSchema.parse(await request.json());
    const providerName = body.provider;
    const provider = getProvider(providerName);
    const apiKey = await credentials.resolveSecret(context, providerName);
    const result = await provider.generate({
      provider: providerName,
      model: body.model ?? defaultModels[providerName],
      messages: [
        { role: "system", content: "Return concise evaluation output." },
        { role: "user", content: body.prompt ?? "Say ok." }
      ],
      temperature: 0.1,
      apiKey: providerName === "ollama" ? (apiKey && !apiKey.startsWith("http") ? apiKey : undefined) : (apiKey ?? undefined),
      baseUrl: providerName === "ollama" && apiKey?.startsWith("http") ? apiKey : undefined
    });

    return apiOk({
      provider: result.provider,
      model: result.model,
      text: result.text,
      usage: result.usage,
      latencyMs: result.latencyMs,
      costEstimate: result.costEstimate
    });
  } catch (error) {
    return apiError(error);
  }
}
