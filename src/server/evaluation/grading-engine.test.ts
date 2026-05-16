import { describe, expect, it } from "vitest";
import { gradeDeterministically } from "@/server/evaluation/grading-engine";

describe("deterministic grading engine", () => {
  it("passes exact JSON-shaped answers with rubric terms", () => {
    const decision = gradeDeterministically({
      outputText: JSON.stringify({ category: "billing", priority: "high" }),
      outputJson: { category: "billing", priority: "high" },
      expectedOutput: { requiredKeys: ["category", "priority"], expected: { category: "billing", priority: "high" } },
      rubric: { mustInclude: ["billing"], mustAvoid: ["refund without approval"] }
    });

    expect(decision.label).toBe("pass");
    expect(decision.score).toBeGreaterThanOrEqual(0.85);
    expect(decision.failureCategories).toEqual([]);
  });

  it("routes schema mismatches into human review or failure with categories", () => {
    const decision = gradeDeterministically({
      outputText: "I am not sure.",
      expectedOutput: { requiredKeys: ["category", "priority"], expected: "category billing priority high" },
      rubric: { mustInclude: ["billing", "high"] },
      passThreshold: 0.9,
      reviewThreshold: 0.75
    });

    expect(["needs_review", "fail"]).toContain(decision.label);
    expect(decision.failureCategories).toContain("schema_mismatch");
    expect(decision.failureCategories).toContain("instruction_miss");
  });

  it("keeps raw score separate from the final clipped score", () => {
    const decision = gradeDeterministically({
      outputText: "",
      expectedOutput: { expected: "complete answer" }
    });

    expect(decision.rawScore).toBeGreaterThanOrEqual(0);
    expect(decision.score).toBeGreaterThanOrEqual(0);
    expect(decision.score).toBeLessThanOrEqual(1);
    expect(decision.label).toBe("fail");
  });
});
