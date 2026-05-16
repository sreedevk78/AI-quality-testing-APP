import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RequestContextError } from "@/server/context";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(error: unknown, status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: error.flatten() },
      { status: 422 }
    );
  }

  if (error instanceof RequestContextError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  if (process.env.NODE_ENV === "production") {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Unexpected server error" }, { status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ ok: false, error: message }, { status });
}
