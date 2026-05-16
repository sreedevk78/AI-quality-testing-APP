export const failureCategories = [
  "hallucination",
  "format_error",
  "incomplete_answer",
  "instruction_miss",
  "unsafe_output",
  "retrieval_failure",
  "tool_misuse",
  "schema_mismatch",
  "timeout",
  "provider_failure",
  "grading_failure"
] as const;

export type FailureCategory = (typeof failureCategories)[number];

export type GradingMetric = {
  key: string;
  score: number;
  weight: number;
  explanation: string;
  categories: FailureCategory[];
};

export type GradingDecision = {
  score: number;
  label: "pass" | "needs_review" | "fail";
  threshold: number;
  reviewThreshold: number;
  explanation: string;
  failureCategories: FailureCategory[];
  metrics: GradingMetric[];
  rawScore: number;
};

export type DeterministicGradingInput = {
  outputText: string;
  outputJson?: unknown;
  expectedOutput?: unknown;
  rubric?: unknown;
  passThreshold?: number;
  reviewThreshold?: number;
};

const defaultWeights = {
  format: 0.2,
  reference: 0.35,
  rubric: 0.3,
  completeness: 0.15
};

export function gradeDeterministically(input: DeterministicGradingInput): GradingDecision {
  const passThreshold = clamp(input.passThreshold ?? 0.85);
  const reviewThreshold = clamp(input.reviewThreshold ?? 0.7);
  const expected = asRecord(input.expectedOutput);
  const rubric = asRecord(input.rubric);
  const metrics = [
    gradeFormat(input, expected),
    gradeReference(input, expected),
    gradeRubric(input, rubric),
    gradeCompleteness(input)
  ];
  const rawScore = weightedAverage(metrics);
  const score = clamp(rawScore);
  const label = score >= passThreshold ? "pass" : score >= reviewThreshold ? "needs_review" : "fail";
  const failureCategories = unique(metrics.flatMap((metric) => metric.categories));

  return {
    score,
    label,
    threshold: passThreshold,
    reviewThreshold,
    explanation: buildExplanation(metrics, label),
    failureCategories,
    metrics,
    rawScore
  };
}

function gradeFormat(input: DeterministicGradingInput, expected: Record<string, unknown> | null): GradingMetric {
  const expectsJson =
    Boolean(expected && (expected.schema || expected.jsonSchema || expected.requiredKeys || expected.expectedJson)) ||
    looksLikeJsonExpectation(expected);

  if (!expectsJson) {
    return metric("format", 1, defaultWeights.format, "No explicit JSON or schema requirement was configured.");
  }

  if (!input.outputJson || typeof input.outputJson !== "object") {
    return metric("format", 0.25, defaultWeights.format, "Output was not valid structured JSON.", ["format_error", "schema_mismatch"]);
  }

  const requiredKeys = normalizeRequiredKeys(expected);
  if (requiredKeys.length === 0) {
    return metric("format", 0.9, defaultWeights.format, "Output is valid JSON.");
  }

  const record = asRecord(input.outputJson) ?? {};
  const missing = requiredKeys.filter((key) => !(key in record));
  if (missing.length > 0) {
    return metric(
      "format",
      Math.max(0.25, 1 - missing.length / requiredKeys.length),
      defaultWeights.format,
      `Missing required JSON keys: ${missing.join(", ")}.`,
      ["schema_mismatch"]
    );
  }

  return metric("format", 1, defaultWeights.format, "Output matches required JSON shape.");
}

function gradeReference(input: DeterministicGradingInput, expected: Record<string, unknown> | null): GradingMetric {
  if (!expected || Object.keys(expected).length === 0) {
    return metric("reference", 1, defaultWeights.reference, "No reference output was configured.");
  }

  const expectedText = stringifyExpectation(expected.expected ?? expected.reference ?? expected.output ?? expected);
  if (!expectedText.trim()) {
    return metric("reference", 1, defaultWeights.reference, "Reference output is empty.");
  }

  const normalizedOutput = normalize(input.outputText);
  const normalizedExpected = normalize(expectedText);
  if (!normalizedOutput) {
    return metric("reference", 0, defaultWeights.reference, "Output was empty and did not match the configured reference.", ["incomplete_answer"]);
  }
  if (normalizedOutput.includes(normalizedExpected) || normalizedExpected.includes(normalizedOutput)) {
    return metric("reference", 1, defaultWeights.reference, "Output matches the configured reference closely.");
  }

  const overlap = tokenOverlap(normalizedOutput, normalizedExpected);
  const categories: FailureCategory[] = overlap < 0.35 ? ["hallucination", "instruction_miss"] : ["incomplete_answer"];
  return metric("reference", overlap, defaultWeights.reference, "Output only partially matches the configured reference.", categories);
}

function gradeRubric(input: DeterministicGradingInput, rubric: Record<string, unknown> | null): GradingMetric {
  if (!rubric || Object.keys(rubric).length === 0) {
    return metric("rubric", 1, defaultWeights.rubric, "No rubric constraints were configured.");
  }

  const mustInclude = normalizeStringList(rubric.mustInclude ?? rubric.must_include ?? rubric.requiredTerms);
  const mustAvoid = normalizeStringList(rubric.mustAvoid ?? rubric.must_avoid ?? rubric.forbiddenTerms);
  const output = normalize(input.outputText);
  const missing = mustInclude.filter((term) => !output.includes(normalize(term)));
  const violations = mustAvoid.filter((term) => output.includes(normalize(term)));
  const totalChecks = Math.max(1, mustInclude.length + mustAvoid.length);
  const passedChecks = totalChecks - missing.length - violations.length;
  const score = clamp(passedChecks / totalChecks);
  const categories: FailureCategory[] = [];
  if (missing.length > 0) categories.push("instruction_miss");
  if (violations.length > 0) categories.push("unsafe_output");

  return metric(
    "rubric",
    score,
    defaultWeights.rubric,
    missing.length || violations.length
      ? `Rubric misses: ${missing.join(", ") || "none"}; violations: ${violations.join(", ") || "none"}.`
      : "Rubric checks passed.",
    categories
  );
}

function gradeCompleteness(input: DeterministicGradingInput): GradingMetric {
  const text = input.outputText.trim();
  if (text.length === 0) {
    return metric("completeness", 0, defaultWeights.completeness, "Output was empty.", ["incomplete_answer"]);
  }
  if (text.length < 20) {
    return metric("completeness", 0.55, defaultWeights.completeness, "Output is short enough to require review.", ["incomplete_answer"]);
  }
  return metric("completeness", 1, defaultWeights.completeness, "Output is non-empty and complete enough for automated scoring.");
}

function metric(
  key: string,
  score: number,
  weight: number,
  explanation: string,
  categories: FailureCategory[] = []
): GradingMetric {
  return { key, score: clamp(score), weight, explanation, categories };
}

function weightedAverage(metrics: GradingMetric[]) {
  const totalWeight = metrics.reduce((sum, item) => sum + item.weight, 0);
  return metrics.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function buildExplanation(metrics: GradingMetric[], label: GradingDecision["label"]) {
  const weak = metrics.filter((metric) => metric.score < 0.75).map((metric) => `${metric.key}: ${metric.explanation}`);
  return weak.length > 0 ? `${label}: ${weak.join(" ")}` : `${label}: all automated checks passed.`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeRequiredKeys(expected: Record<string, unknown> | null) {
  if (!expected) return [];
  return normalizeStringList(expected.requiredKeys ?? expected.required_keys ?? asRecord(expected.schema)?.required ?? asRecord(expected.jsonSchema)?.required);
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function stringifyExpectation(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenOverlap(output: string, expected: string) {
  const outputTokens = new Set(output.split(/\W+/).filter(Boolean));
  const expectedTokens = expected.split(/\W+/).filter(Boolean);
  if (expectedTokens.length === 0) return 1;
  const matches = expectedTokens.filter((token) => outputTokens.has(token)).length;
  return matches / expectedTokens.length;
}

function looksLikeJsonExpectation(expected: Record<string, unknown> | null) {
  if (!expected) return false;
  return Object.values(expected).some((value) => value && typeof value === "object");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
