import type { ProviderName } from "@/lib/types";
import { AIProviderError } from "@/lib/ai/types";

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 60_000);

export async function fetchProvider(
  provider: ProviderName,
  input: RequestInfo | URL,
  init: RequestInit & { abortSignal?: AbortSignal } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let combinedSignal = controller.signal;
  if (init.abortSignal) {
    if (typeof AbortSignal.any === "function") {
      combinedSignal = AbortSignal.any([controller.signal, init.abortSignal]);
    } else {
      init.abortSignal.addEventListener("abort", () => controller.abort(init.abortSignal?.reason));
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: combinedSignal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new AIProviderError(`${provider} request timed out after ${timeoutMs}ms`, provider, 408);
    }

    const message = error instanceof Error ? error.message : "network request failed";
    throw new AIProviderError(`${provider} request failed before receiving a response: ${message}`, provider);
  } finally {
    clearTimeout(timeout);
  }
}

export async function providerErrorMessage(provider: ProviderName, response: Response) {
  const retryAfterMs = retryAfterHeaderMs(response.headers.get("retry-after"));
  let details = "";

  try {
    details = (await response.text()).slice(0, 500);
  } catch {
    details = "";
  }

  return new AIProviderError(
    `${provider} request failed with ${response.status}${details ? `: ${details}` : ""}`,
    provider,
    response.status,
    retryAfterMs
  );
}

export function retryAfterHeaderMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());

  return undefined;
}

export function parseMaybeJson(text: string) {
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  if (fenced) return tryParseJson(fenced.trim());

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  return undefined;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
