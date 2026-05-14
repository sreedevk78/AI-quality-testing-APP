import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";

export class SearchService {
  async global(context: RequestContext, query: string) {
    if (!query.trim()) {
      return { prompts: [], datasets: [], runs: [], feedback: [] };
    }

    const contains = { contains: query, mode: "insensitive" as const };
    const [prompts, datasets, runs, feedback] = await Promise.all([
      prisma.promptVersion.findMany({
        where: { workspaceId: context.workspaceId, OR: [{ title: contains }, { promptKey: contains }] },
        take: 10
      }),
      prisma.dataset.findMany({
        where: { workspaceId: context.workspaceId, OR: [{ name: contains }, { description: contains }] },
        take: 10
      }),
      prisma.run.findMany({
        where: { workspaceId: context.workspaceId, OR: [{ modelName: contains }] },
        take: 10
      }),
      prisma.promptFeedback.findMany({
        where: { workspaceId: context.workspaceId, OR: [{ note: contains }, { severity: contains }] },
        take: 10
      })
    ]);

    return { prompts, datasets, runs, feedback };
  }
}
