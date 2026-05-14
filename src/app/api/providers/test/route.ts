import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";
import type { ProviderName } from "@/lib/types";
import { apiError } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const body = (await request.json()) as {
      provider?: ProviderName;
      model?: string;
      prompt?: string;
    };
    const providerName = body.provider ?? "groq";
    const provider = getProvider(providerName);
    const result = await provider.generate({
      provider: providerName,
      model: body.model ?? (providerName === "groq" ? "llama-3.1-8b-instant" : "gemini-2.5-flash"),
      messages: [
        { role: "system", content: "Return concise evaluation output." },
        { role: "user", content: body.prompt ?? "Say ok." }
      ],
      temperature: 0.1
    });

    return NextResponse.json({
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
