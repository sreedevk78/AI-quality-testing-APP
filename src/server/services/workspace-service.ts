import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";

export class WorkspaceService {
  private readonly events = new EventService();

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

  async createForUser(context: RequestContext, input: { name: string; role?: string; inviteEmail?: string }) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    const workspace = await prisma.$transaction(async (tx) => {
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

      if (input.inviteEmail) {
        const invitedUser = await tx.user.upsert({
          where: { email: input.inviteEmail },
          update: {},
          create: {
            authUserId: `invite:${input.inviteEmail}`,
            email: input.inviteEmail
          }
        });

        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitedUser.id } },
          update: { role: "reviewer", invitedBy: context.userId },
          create: {
            workspaceId: workspace.id,
            userId: invitedUser.id,
            role: "reviewer",
            invitedBy: context.userId
          }
        });
      }

      return workspace;
    });

    await this.events.emitRaw({
      workspaceId: workspace.id,
      actorUserId: context.userId,
      entityType: "workspace",
      entityId: workspace.id,
      action: "workspace_created",
      payload: { name: workspace.name, plan: workspace.plan }
    });

    return workspace;
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

    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: user.id } },
      update: { role: input.role, invitedBy: context.userId },
      create: {
        workspaceId: context.workspaceId,
        userId: user.id,
        role: input.role,
        invitedBy: context.userId
      }
    });

    await this.events.emit(context, {
      entityType: "workspace_member",
      entityId: member.id,
      action: "permission_change",
      payload: { email: input.email, role: input.role, operation: "invite_or_update" }
    });

    return member;
  }

  async updateMemberRole(context: RequestContext, memberId: string, role: "admin" | "editor" | "reviewer" | "viewer") {
    const member = await prisma.workspaceMember.update({
      where: { id: memberId, workspaceId: context.workspaceId },
      data: { role }
    });

    await this.events.emit(context, {
      entityType: "workspace_member",
      entityId: member.id,
      action: "permission_change",
      payload: { role, operation: "role_update" }
    });

    return member;
  }

  async removeMember(context: RequestContext, memberId: string) {
    const member = await prisma.workspaceMember.delete({
      where: { id: memberId, workspaceId: context.workspaceId }
    });

    await this.events.emit(context, {
      entityType: "workspace_member",
      entityId: member.id,
      action: "permission_change",
      payload: { operation: "remove" }
    });

    return member;
  }
}
