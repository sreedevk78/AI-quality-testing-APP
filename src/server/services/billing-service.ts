import { prisma } from "@/lib/prisma";
import { RequestContextError, type RequestContext } from "@/server/context";

const PLAN_CASE_QUOTAS: Record<string, number> = {
  free: 500,
  pro: 10000,
  team: 50000
};

const PLAN_MONTHLY_COST_LIMITS: Record<string, number> = {
  free: 10,
  pro: 250,
  team: 1500
};

export class BillingService {
  async usageSummary(context: RequestContext) {
    const monthStart = currentMonthStart();
    const aggregate = await prisma.usageEvent.aggregate({
      where: { workspaceId: context.workspaceId },
      _sum: {
        tokensIn: true,
        tokensOut: true,
        costEstimate: true
      }
    });
    const monthly = await prisma.usageEvent.aggregate({
      where: { workspaceId: context.workspaceId, occurredAt: { gte: monthStart } },
      _sum: { costEstimate: true }
    });
    const workspace = await prisma.workspace.findUnique({ where: { id: context.workspaceId }, select: { plan: true } });
    const plan = workspace?.plan ?? "free";
    const monthlyLimit = Number(process.env.RUN_MONTHLY_COST_LIMIT_USD ?? PLAN_MONTHLY_COST_LIMITS[plan] ?? PLAN_MONTHLY_COST_LIMITS.free);

    return {
      tokensIn: aggregate._sum.tokensIn ?? 0,
      tokensOut: aggregate._sum.tokensOut ?? 0,
      costEstimate: Number(aggregate._sum.costEstimate ?? 0),
      monthlyCostEstimate: Number(monthly._sum.costEstimate ?? 0),
      monthlyCostLimit: monthlyLimit,
      monthlyCostPercent: monthlyLimit > 0 ? Number(monthly._sum.costEstimate ?? 0) / monthlyLimit : 0
    };
  }

  async assertRunQuota(context: RequestContext, requestedCases: number) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { plan: true }
    });
    const plan = workspace?.plan ?? "free";
    const quota = PLAN_CASE_QUOTAS[plan] ?? PLAN_CASE_QUOTAS.free;
    const monthStart = currentMonthStart();

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

  async assertRunBudget(context: RequestContext, input: { requestedCases: number; estimatedCost: number }) {
    await this.assertRunQuota(context, input.requestedCases);

    const maxCasesPerRun = Number(process.env.RUN_MAX_CASES_PER_RUN ?? 1000);
    if (input.requestedCases > maxCasesPerRun) {
      throw new RequestContextError(`This run has ${input.requestedCases} cases, above the per-run safety limit of ${maxCasesPerRun}.`, 402);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { plan: true }
    });
    const plan = workspace?.plan ?? "free";
    const monthlyCostLimit = Number(process.env.RUN_MONTHLY_COST_LIMIT_USD ?? PLAN_MONTHLY_COST_LIMITS[plan] ?? PLAN_MONTHLY_COST_LIMITS.free);
    const runCostLimit = Number(process.env.RUN_COST_LIMIT_USD ?? Math.max(1, monthlyCostLimit * 0.25));
    const monthly = await prisma.usageEvent.aggregate({
      where: { workspaceId: context.workspaceId, occurredAt: { gte: currentMonthStart() } },
      _sum: { costEstimate: true }
    });
    const usedCost = Number(monthly._sum.costEstimate ?? 0);

    if (input.estimatedCost > runCostLimit) {
      throw new RequestContextError(`Estimated run cost $${input.estimatedCost.toFixed(4)} exceeds the per-run limit of $${runCostLimit.toFixed(2)}.`, 402);
    }

    if (usedCost + input.estimatedCost > monthlyCostLimit) {
      throw new RequestContextError(
        `Estimated run cost would exceed the ${plan} monthly budget. $${usedCost.toFixed(4)} / $${monthlyCostLimit.toFixed(2)} already used.`,
        402
      );
    }
  }
}

function currentMonthStart() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart;
}
