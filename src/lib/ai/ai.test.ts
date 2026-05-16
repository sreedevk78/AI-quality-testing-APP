import { describe, expect, it } from "vitest";
import { GeminiProvider } from "@/lib/ai/gemini";
import { GroqProvider } from "@/lib/ai/groq";
import { OllamaProvider } from "@/lib/ai/ollama";
import { PromptService } from "@/server/services/prompt-service";
import { ComparisonService } from "@/server/services/comparison-service";
import { assertCanAdminWorkspace, assertCanReview, assertCanWrite, type RequestContext } from "@/server/context";
import { parseMaybeJson, retryAfterHeaderMs } from "@/lib/ai/http";

describe("provider cost estimation", () => {
  it("estimates Groq cost from normalized usage", () => {
    const provider = new GroqProvider();
    expect(provider.estimateCost({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }, "llama-3.3-70b-versatile")).toBeGreaterThan(0);
  });

  it("estimates Gemini cost from normalized usage", () => {
    const provider = new GeminiProvider();
    expect(provider.estimateCost({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }, "gemini-2.5-flash")).toBeGreaterThan(0);
  });

  it("treats local Ollama calls as zero-cost while preserving the provider interface", () => {
    const provider = new OllamaProvider();
    expect(provider.estimateCost({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }, "llama3.1")).toBe(0);
  });
});

describe("prompt rendering", () => {
  it("renders named variables", () => {
    const service = new PromptService();
    expect(service.render("Hello {{name}}", { name: "QA" })).toBe("Hello QA");
  });
});

describe("release gates", () => {
  it("allows passing reports with non-negative score delta", () => {
    const service = new ComparisonService();
    expect(
      service.evaluateReleaseGate({
        id: "cmp",
        baseline: "v1",
        candidate: "v2",
        passFailStatus: "pass",
        scoreDelta: 0.03,
        latencyDelta: -0.1,
        costDelta: 0.01,
        threshold: 0.85,
        baselineScore: 0.82,
        candidateScore: 0.85
      }).allowed
    ).toBe(true);
  });
});

describe("role guards", () => {
  const baseContext: RequestContext = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    role: "viewer"
  };

  it("blocks viewers from write actions", () => {
    expect(() => assertCanWrite(baseContext)).toThrow(/owner, admin, or editor/);
  });

  it("allows reviewers to submit reviews but not writes", () => {
    const reviewer = { ...baseContext, role: "reviewer" as const };
    expect(() => assertCanReview(reviewer)).not.toThrow();
    expect(() => assertCanWrite(reviewer)).toThrow();
  });

  it("reserves workspace administration for owners and admins", () => {
    const editor = { ...baseContext, role: "editor" as const };
    const admin = { ...baseContext, role: "admin" as const };
    expect(() => assertCanAdminWorkspace(editor)).toThrow(/owner or admin/);
    expect(() => assertCanAdminWorkspace(admin)).not.toThrow();
  });
});

describe("provider response helpers", () => {
  it("parses JSON even when providers wrap it in markdown fences", () => {
    expect(parseMaybeJson("```json\n{\"score\":0.9}\n```")).toEqual({ score: 0.9 });
  });

  it("normalizes Retry-After seconds into milliseconds", () => {
    expect(retryAfterHeaderMs("2")).toBe(2000);
  });
});
