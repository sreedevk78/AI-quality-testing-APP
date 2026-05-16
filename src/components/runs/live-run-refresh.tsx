"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const liveStatuses = new Set(["queued", "initializing", "running", "retrying", "needs_review"]);

export function LiveRunRefresh({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!liveStatuses.has(status)) return;
    const interval = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(interval);
  }, [router, status]);

  return null;
}
