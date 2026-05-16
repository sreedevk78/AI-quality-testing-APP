import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { GradingService } from "@/server/services/grading-service";

const grading = new GradingService();

const definitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().default("llm_rubric"),
  provider: z.enum(["groq", "gemini", "ollama"]).default("groq"),
  modelName: z.string().default("llama-3.3-70b-versatile"),
  promptTemplate: z.string().min(1),
  rubricJson: z.record(z.unknown()).optional()
});

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await grading.getDefinitions(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const body = definitionSchema.parse(await request.json());
    return apiOk(await grading.createDefinition(context, body), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
