import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";

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
    return prisma.$transaction(async (tx) => {
      const auditLog = await tx.auditLog.create({
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

      await new EventService(tx).emit(context, {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action.replaceAll(".", "_"),
        payload: {
          before: input.before,
          after: input.after,
          auditLogId: auditLog.id
        }
      });

      return auditLog;
    });
  }
}
