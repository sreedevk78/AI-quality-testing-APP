/**
 * Client-side API helper for calling Next.js API routes.
 * Handles JSON serialization, error parsing, and typed responses.
 */

export type ApiResult<T = unknown> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
  issues?: unknown;
  status: number;
};

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });

    const body = await response.json();

    if (!response.ok || body.ok === false) {
      return {
        ok: false,
        error: body.error ?? `Request failed with ${response.status}`,
        issues: body.issues,
        status: response.status,
      };
    }

    return { ok: true, data: body.data ?? body };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    };
  }
}

export const api = {
  get<T>(url: string) {
    return request<T>(url, { method: "GET" });
  },

  post<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string) {
    return request<T>(url, { method: "DELETE" });
  },

  /** Download a file as blob and trigger browser download */
  async download(url: string, filename: string) {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false as const, error: `Download failed with ${response.status}`, status: response.status };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
    return { ok: true as const, data: null };
  },
};
