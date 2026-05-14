import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";

export class AuditService {
  async log(
    context: RequestContext,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      before?: unknown;
      after?: unknown;
    }
  ) {
    return prisma.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.before ?? undefined,
        afterJson: input.after ?? undefined
      }
    });
  }
}
