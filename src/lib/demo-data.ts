import { 
  EvalRun, 
  Dataset, 
  PromptVersion, 
  TraceSpan, 
  ReviewItem, 
  ComparisonReport
} from "./types";

export type MetricPoint = { date: string; score: number; cost: number; latency: number };
export type AuditLog = { id: string; user: string; action: string; entity: string; time: string };

export const promptVersions: PromptVersion[] = [
  {
    id: "pv_001",
    key: "support-triage",
    title: "Support Triage Agent",
    version: 7,
    status: "active",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    tags: ["support", "routing", "json"],
    lastRunScore: 0.91,
    changelog: "Tightened escalation criteria and JSON schema instructions.",
    updatedAt: "2026-05-14 20:30",
    systemPrompt: "You are a helpful assistant.",
    userPromptTemplate: "Hello {{name}}",
    projectId: "demo"
  },
  {
    id: "pv_002",
    key: "support-triage",
    title: "Support Triage Agent",
    version: 6,
    status: "approved",
    provider: "gemini",
    model: "gemini-2.5-flash",
    temperature: 0.1,
    tags: ["support", "stable"],
    lastRunScore: 0.84,
    changelog: "Initial production release of the triage logic.",
    updatedAt: "2026-05-10 14:22",
    systemPrompt: "You are a helpful assistant.",
    userPromptTemplate: "Hello {{name}}",
    projectId: "demo"
  },
  {
    id: "pv_003",
    key: "creative-writer",
    title: "Story Idea Generator",
    version: 1,
    status: "draft",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    temperature: 0.8,
    tags: ["creative", "experimental"],
    lastRunScore: 0,
    changelog: "Initial draft for brainstorm features.",
    updatedAt: "2026-05-13 09:15",
    systemPrompt: "You are a helpful assistant.",
    userPromptTemplate: "Hello {{name}}",
    projectId: "demo"
  }
];

export const datasets: Dataset[] = [
  {
    id: "ds_001",
    name: "Customer Support Gold Suite",
    version: 4,
    coverage: 0.95,
    status: "active",
    tags: ["production"],
    cases: [
      {
        id: "c_001",
        name: "Angry cancellation threat",
        input: '{"message": "I am going to cancel my subscription if you do not fix this now!"}',
        expected: "Identify as high-risk retention and escalate to Tier 2 support.",
        difficulty: "hard",
        tags: ["retention", "sentiment"],
        status: "active"
      },
      {
        id: "c_002",
        name: "Simple password reset",
        input: '{"message": "How do I change my password?"}',
        expected: "Provide link to password reset page and basic instructions.",
        difficulty: "easy",
        tags: ["faq"],
        status: "active"
      }
    ]
  }
];

export const runs: EvalRun[] = [
  {
    id: "run_001",
    name: "Llama 3.3 70B Regression",
    promptVersion: "Support Triage v7",
    dataset: "Gold Suite v4",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    status: "completed",
    progress: 1,
    averageScore: 0.92,
    totalCost: 0.042,
    failures: 0,
    createdAt: "2026-05-14 21:05",
    items: []
  },
  {
    id: "run_002",
    name: "Gemini 2.5 Flash Baseline",
    promptVersion: "Support Triage v6",
    dataset: "Gold Suite v4",
    provider: "gemini",
    model: "gemini-2.5-flash",
    status: "completed",
    progress: 1,
    averageScore: 0.85,
    totalCost: 0.028,
    failures: 2,
    createdAt: "2026-05-12 11:45",
    items: []
  }
];

export const traceSpans: TraceSpan[] = [
  {
    id: "span_1",
    type: "model",
    name: "Triage Pipeline",
    status: "pass",
    durationMs: 1450,
    tokensIn: 450,
    tokensOut: 120,
    input: '{"message": "I want a refund"}',
    output: '{"intent": "refund", "priority": "high"}'
  }
];

export const reviewQueue: ReviewItem[] = [
  {
    id: "rev_001",
    caseName: "Technical support triage",
    run: "Groq / Llama 3.3 70B",
    runId: "run_001",
    score: 0.88,
    rubric: "Strict adherence to safety guidelines and helpfulness",
    status: "pending"
  },
  {
    id: "rev_002",
    caseName: "Warranty edge case",
    run: "Groq / Llama 3.3 70B",
    runId: "run_001",
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
    threshold: 0.88,
    baselineScore: 0.85,
    candidateScore: 0.92
  },
  {
    id: "cmp_002",
    baseline: "Tool Planner v1",
    candidate: "Tool Planner v2",
    passFailStatus: "fail",
    scoreDelta: -0.04,
    latencyDelta: 0.19,
    costDelta: 0.027,
    threshold: 0.85,
    baselineScore: 0.88,
    candidateScore: 0.84
  }
];

export const analyticsData: MetricPoint[] = [
  { date: "2026-05-08", score: 82, cost: 0.05, latency: 1200 },
  { date: "2026-05-09", score: 84, cost: 0.04, latency: 1150 },
  { date: "2026-05-10", score: 81, cost: 0.06, latency: 1300 },
  { date: "2026-05-11", score: 86, cost: 0.03, latency: 1100 },
  { date: "2026-05-12", score: 88, cost: 0.04, latency: 1050 },
  { date: "2026-05-13", score: 87, cost: 0.05, latency: 1100 },
  { date: "2026-05-14", score: 91, cost: 0.04, latency: 980 }
];

export const auditLogs: AuditLog[] = [
  { id: "log_1", user: "sreedev@example.com", action: "prompt_release", entity: "Support Triage v7", time: "2h ago" },
  { id: "log_2", user: "system", action: "automated_grade", entity: "Run #1240", time: "4h ago" },
  { id: "log_3", user: "reviewer_1", action: "manual_review", entity: "Case #c_09", time: "1d ago" }
];
