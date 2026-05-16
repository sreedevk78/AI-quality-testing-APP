import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";

type EventDb = PrismaClient | Prisma.TransactionClient;

export type SystemEventInput = {
  entityType: string;
  entityId: string;
  action: string;
  payload?: unknown;
  metadata?: unknown;
  actorUserId?: string | null;
};

export class EventService {
  constructor(private readonly db: EventDb = prisma) {}

  emit(context: RequestContext, input: SystemEventInput) {
    return this.emitRaw({
      workspaceId: context.workspaceId,
      actorUserId: input.actorUserId === undefined ? context.userId : input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload,
      metadata: input.metadata
    });
  }

  emitRaw(input: {
    workspaceId: string;
    actorUserId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    payload?: unknown;
    metadata?: unknown;
  }) {
    return this.db.systemEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId ?? undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        payloadJson: (input.payload ?? {}) as Prisma.InputJsonValue,
        metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });
  }

  list(context: RequestContext, options: { query?: string; take?: number } = {}) {
    const query = options.query?.trim();
    return this.db.systemEvent.findMany({
      where: {
        workspaceId: context.workspaceId,
        ...(query
          ? {
              OR: [
                { action: { contains: query, mode: "insensitive" } },
                { entityType: { contains: query, mode: "insensitive" } },
                { entityId: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: { actor: { select: { email: true, fullName: true } } },
      orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
      take: options.take ?? 100
    });
  }
}
