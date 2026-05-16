"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function LiveRunRefresh({
  isActive = true,
  pollUrl,
  intervalMs = 2500,
}: {
  isActive?: boolean;
  pollUrl?: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastDataRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(async () => {
      if (pollUrl) {
        try {
          const res = await fetch(pollUrl);
          if (!res.ok) return;
          const text = await res.text();
          if (lastDataRef.current !== null && text !== lastDataRef.current) {
            router.refresh();
          }
          lastDataRef.current = text;
        } catch (err) {
          // Ignore fetch errors during polling
        }
      } else {
        router.refresh();
      }
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [isActive, pollUrl, intervalMs, router]);

  return null;
}
