import { prisma } from "@/lib/prisma";
import { RequestContextError, type RequestContext } from "@/server/context";

const PLAN_CASE_QUOTAS: Record<string, number> = {
  free: 500,
  pro: 10000,
  team: 50000
};

export class BillingService {
  async usageSummary(context: RequestContext) {
    const aggregate = await prisma.usageEvent.aggregate({
      where: { workspaceId: context.workspaceId },
      _sum: {
        tokensIn: true,
        tokensOut: true,
        costEstimate: true
      }
    });

    return {
      tokensIn: aggregate._sum.tokensIn ?? 0,
      tokensOut: aggregate._sum.tokensOut ?? 0,
      costEstimate: Number(aggregate._sum.costEstimate ?? 0)
    };
  }

  async assertRunQuota(context: RequestContext, requestedCases: number) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { plan: true }
    });
    const plan = workspace?.plan ?? "free";
    const quota = PLAN_CASE_QUOTAS[plan] ?? PLAN_CASE_QUOTAS.free;
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const usedCases = await prisma.runItem.count({
      where: {
        workspaceId: context.workspaceId,
        createdAt: { gte: monthStart }
      }
    });

    if (usedCases + requestedCases > quota) {
      throw new RequestContextError(
        `Run quota exceeded for the ${plan} plan. ${usedCases}/${quota} cases already used this month.`,
        402
      );
    }
  }
}
