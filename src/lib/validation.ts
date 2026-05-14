import { z } from "zod";

export const promptVersionSchema = z.object({
  projectId: z.string().uuid(),
  promptKey: z.string().min(2),
  title: z.string().min(2),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  variablesSchema: z.record(z.unknown()).default({}),
  provider: z.enum(["gemini", "groq"]),
  modelName: z.string().min(2),
  modelParams: z.object({
    temperature: z.number().min(0).max(2).default(0.2),
    topP: z.number().min(0).max(1).default(1),
    seed: z.number().int().optional()
  })
});

export const datasetCaseSchema = z.object({
  datasetId: z.string().uuid(),
  inputPayload: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  rubric: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

export const runBuilderSchema = z.object({
  promptVersionId: z.string().uuid(),
  datasetId: z.string().uuid(),
  provider: z.enum(["gemini", "groq"]),
  modelName: z.string().min(2),
  temperature: z.number().min(0).max(2),
  graderDefinitionId: z.string().uuid().optional()
});
