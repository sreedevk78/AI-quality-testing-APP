import type {
  ComparisonReport,
  Dataset,
  EvalRun,
  PromptVersion,
  ReviewItem,
  TraceSpan
} from "@/lib/types";

export const promptVersions: PromptVersion[] = [
  {
    id: "pv_001",
    key: "support_triage",
    title: "Support Triage Agent",
    version: 7,
    status: "active",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    tags: ["support", "routing", "json"],
    lastRunScore: 0.91,
    changelog: "Tightened escalation criteria and JSON schema instructions.",
    updatedAt: "2026-05-14 20:30"
  },
  {
    id: "pv_002",
    key: "refund_policy",
    title: "Refund Policy Assistant",
    version: 4,
    status: "approved",
    provider: "gemini",
    model: "gemini-2.5-flash",
    temperature: 0.1,
    tags: ["policy", "safety"],
    lastRunScore: 0.88,
    changelog: "Added refusal behavior for unverifiable policy claims.",
    updatedAt: "2026-05-14 19:10"
  },
  {
    id: "pv_003",
    key: "agent_planner",
    title: "Tool Planner",
    version: 2,
    status: "draft",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    temperature: 0.35,
    tags: ["agent", "tools"],
    lastRunScore: 0.74,
    changelog: "Draft planner prompt for multi-step tool selection.",
    updatedAt: "2026-05-14 18:42"
  }
];

export const datasets: Dataset[] = [
  {
    id: "ds_001",
    name: "Support routing regression",
    version: 3,
    status: "active",
    tags: ["routing", "golden"],
    coverage: 0.82,
    cases: [
      {
        id: "case_001",
        name: "Billing escalation with refund request",
        input: "Customer asks for refund after duplicate charge.",
        expected: "Classify as billing, request account details, avoid promising refund.",
        tags: ["billing", "escalation"],
        difficulty: "medium",
        status: "active"
      },
      {
        id: "case_002",
        name: "Angry cancellation threat",
        input: "Customer threatens churn due to delayed delivery.",
        expected: "Acknowledge frustration, classify as retention risk, escalate.",
        tags: ["retention", "tone"],
        difficulty: "hard",
        status: "active"
      },
      {
        id: "case_003",
        name: "Simple shipping update",
        input: "Customer asks where the package is.",
        expected: "Ask for order ID and classify as shipping support.",
        tags: ["shipping"],
        difficulty: "easy",
        status: "active"
      }
    ]
  },
  {
    id: "ds_002",
    name: "Policy safety suite",
    version: 1,
    status: "active",
    tags: ["policy", "safety"],
    coverage: 0.68,
    cases: [
      {
        id: "case_004",
        name: "Warranty edge case",
        input: "User asks for coverage after accidental damage.",
        expected: "Do not invent coverage; cite policy uncertainty.",
        tags: ["policy"],
        difficulty: "medium",
        status: "active"
      }
    ]
  }
];

export const runs: EvalRun[] = [
  {
    id: "run_1042",
    name: "Support triage v7 vs routing suite",
    promptVersion: "Support Triage Agent v7",
    dataset: "Support routing regression v3",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    status: "completed",
    progress: 1,
    averageScore: 0.91,
    totalCost: 0.132,
    failures: 1,
    createdAt: "2026-05-14 20:54",
    items: [
      {
        id: "ri_001",
        caseName: "Billing escalation with refund request",
        status: "pass",
        score: 0.94,
        latencyMs: 824,
        cost: 0.041,
        traceId: "tr_001"
      },
      {
        id: "ri_002",
        caseName: "Angry cancellation threat",
        status: "warning",
        score: 0.79,
        latencyMs: 1018,
        cost: 0.052,
        traceId: "tr_002"
      },
      {
        id: "ri_003",
        caseName: "Simple shipping update",
        status: "pass",
        score: 0.99,
        latencyMs: 612,
        cost: 0.039,
        traceId: "tr_003"
      }
    ]
  },
  {
    id: "run_1041",
    name: "Support triage v6 baseline",
    promptVersion: "Support Triage Agent v6",
    dataset: "Support routing regression v3",
    provider: "gemini",
    model: "gemini-2.5-flash",
    status: "completed",
    progress: 1,
    averageScore: 0.84,
    totalCost: 0.118,
    failures: 3,
    createdAt: "2026-05-14 19:37",
    items: []
  }
];

export const traceSpans: TraceSpan[] = [
  {
    id: "span_001",
    type: "model",
    name: "Render prompt and call Groq",
    status: "pass",
    durationMs: 824,
    tokensIn: 612,
    tokensOut: 184,
    input: "{ customer_message: 'I was charged twice and need a refund now.' }",
    output: "{ category: 'billing', escalation: true, confidence: 0.94 }"
  },
  {
    id: "span_002",
    parentId: "span_001",
    type: "guardrail",
    name: "Policy claim check",
    status: "pass",
    durationMs: 42,
    tokensIn: 184,
    tokensOut: 32,
    input: "Check response for unsupported refund promise.",
    output: "No unsupported promise found."
  },
  {
    id: "span_003",
    parentId: "span_001",
    type: "grader",
    name: "Rubric grader",
    status: "pass",
    durationMs: 318,
    tokensIn: 398,
    tokensOut: 86,
    input: "Score routing, policy compliance, and tone.",
    output: "{ score: 0.94, label: 'pass', rationale: 'Correct category and safe escalation.' }"
  }
];

export const reviewQueue: ReviewItem[] = [
  {
    id: "rev_001",
    caseName: "Angry cancellation threat",
    run: "Support triage v7 vs routing suite",
    score: 0.79,
    rubric: "Tone, escalation, retention risk identification",
    status: "pending"
  },
  {
    id: "rev_002",
    caseName: "Warranty edge case",
    run: "Refund Policy Assistant v4",
    score: 0.83,
    rubric: "Policy grounding and refusal correctness",
    status: "pending"
  }
];

export const comparisonReports: ComparisonReport[] = [
  {
    id: "cmp_001",
    baseline: "Support Triage Agent v6",
    candidate: "Support Triage Agent v7",
    passFailStatus: "pass",
    scoreDelta: 0.07,
    latencyDelta: -0.08,
    costDelta: 0.014,
    threshold: 0.88
  },
  {
    id: "cmp_002",
    baseline: "Tool Planner v1",
    candidate: "Tool Planner v2",
    passFailStatus: "fail",
    scoreDelta: -0.04,
    latencyDelta: 0.19,
    costDelta: 0.027,
    threshold: 0.85
  }
];

export const scoreTrend = [
  { name: "Mon", score: 82, failures: 8, cost: 0.32 },
  { name: "Tue", score: 85, failures: 6, cost: 0.28 },
  { name: "Wed", score: 88, failures: 5, cost: 0.34 },
  { name: "Thu", score: 91, failures: 3, cost: 0.39 },
  { name: "Fri", score: 90, failures: 4, cost: 0.36 }
];
