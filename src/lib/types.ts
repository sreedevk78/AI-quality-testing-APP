export type Status =
  | "pass"
  | "warning"
  | "fail"
  | "queued"
  | "initializing"
  | "running"
  | "retrying"
  | "partially_failed"
  | "needs_review"
  | "completed"
  | "failed"
  | "cancelled"
  | "approved";

export type ProviderName = "gemini" | "groq" | "ollama";

export type PromptVersion = {
  id: string;
  key: string;
  title: string;
  version: number;
  status: "draft" | "active" | "approved" | "archived";
  provider: ProviderName;
  model: string;
  temperature: number;
  tags: string[];
  lastRunScore: number;
  changelog: string;
  updatedAt: string;
  systemPrompt: string;
  userPromptTemplate: string;
  projectId: string;
};

export type DatasetCase = {
  id: string;
  name: string;
  input: string;
  expected: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "inactive";
};

export type Dataset = {
  id: string;
  name: string;
  version: number;
  status: "draft" | "active" | "archived";
  tags: string[];
  coverage: number;
  cases: DatasetCase[];
};

export type RunItem = {
  id: string;
  caseName: string;
  status: Status;
  score: number;
  latencyMs: number;
  cost: number;
  traceId: string;
};

export type EvalRun = {
  id: string;
  name: string;
  promptVersion: string;
  dataset: string;
  provider: ProviderName;
  model: string;
  status: "queued" | "initializing" | "running" | "retrying" | "partially_failed" | "needs_review" | "completed" | "failed" | "cancelled";
  progress: number;
  averageScore: number;
  totalCost: number;
  failures: number;
  createdAt: string;
  items: RunItem[];
};

export type TraceSpan = {
  id: string;
  parentId?: string;
  type: "root" | "model" | "retrieval" | "tool" | "guardrail" | "grader" | "review" | "error";
  name: string;
  status: Status;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  input: string;
  output: string;
};

export type ReviewItem = {
  id: string;
  caseName: string;
  run: string;
  runId: string;
  score: number;
  rubric: string;
  status: "pending" | "reviewed" | "pass" | "fail" | "warning" | "needs_review";
  input?: string;
  output?: string;
  expected?: string;
};

export type ComparisonReport = {
  id: string;
  baseline: string;
  candidate: string;
  passFailStatus: "pass" | "fail";
  scoreDelta: number;
  latencyDelta: number;
  costDelta: number;
  threshold: number;
  candidatePromptVersionId?: string;
  candidateRunId?: string;
  baselineScore: number;
  candidateScore: number;
};
