import { describe, expect, it, vi } from "vitest";
import { calculateBackoffMs } from "@/server/services/job-service";

describe("background job retry policy", () => {
  it("uses bounded exponential backoff with jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(calculateBackoffMs(1)).toBe(2000);
    expect(calculateBackoffMs(2)).toBe(4000);
    expect(calculateBackoffMs(99)).toBe(64000);

    vi.restoreAllMocks();
  });
});
