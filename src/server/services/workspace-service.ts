import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";

export class WorkspaceService {
  current(context: RequestContext) {
    return prisma.workspace.findFirst({
      where: {
        id: context.workspaceId,
        members: { some: { userId: context.userId } }
      },
      include: { members: { include: { user: true } } }
    });
  }

  listForUser(context: RequestContext) {
    return prisma.workspace.findMany({
      where: { members: { some: { userId: context.userId } } },
      orderBy: { updatedAt: "desc" }
    });
  }

  createForUser(context: RequestContext, input: { name: string; role?: string; inviteEmail?: string }) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: `${slug}-${Date.now().toString(36)}`,
          ownerId: context.userId,
          plan: "free",
          status: "active"
        }
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: context.userId,
          role: "owner",
          joinedAt: new Date()
        }
      });

      await tx.project.create({
        data: {
          workspaceId: workspace.id,
          name: "Default Project",
          description: "Initial project for AI evaluation workflows.",
          createdBy: context.userId,
          defaultProvider: "groq",
          defaultModel: "llama-3.3-70b-versatile",
          defaultTemperature: 0.2,
          tags: ["default"]
        }
      });

      return workspace;
    });
  }

  async inviteMember(context: RequestContext, input: { email: string; role: "admin" | "editor" | "reviewer" | "viewer" }) {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {},
      create: {
        authUserId: `invite:${input.email}`,
        email: input.email
      }
    });

    return prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: user.id } },
      update: { role: input.role, invitedBy: context.userId },
      create: {
        workspaceId: context.workspaceId,
        userId: user.id,
        role: input.role,
        invitedBy: context.userId
      }
    });
  }

  updateMemberRole(context: RequestContext, memberId: string, role: "admin" | "editor" | "reviewer" | "viewer") {
    return prisma.workspaceMember.update({
      where: { id: memberId, workspaceId: context.workspaceId },
      data: { role }
    });
  }

  removeMember(context: RequestContext, memberId: string) {
    return prisma.workspaceMember.delete({
      where: { id: memberId, workspaceId: context.workspaceId }
    });
  }
}
