import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const DEMO_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_PROJECT_ID = "33333333-3333-4333-8333-333333333333";

export type RequestContext = {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "editor" | "reviewer" | "viewer";
  authUserId?: string;
};

export class RequestContextError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

function authUserProfile(authUser: SupabaseAuthUser) {
  return {
    authUserId: authUser.id,
    email: authUser.email ?? `${authUser.id}@unknown.local`,
    fullName:
      typeof authUser.user_metadata?.full_name === "string"
        ? authUser.user_metadata.full_name
        : typeof authUser.user_metadata?.name === "string"
          ? authUser.user_metadata.name
          : undefined,
    avatarUrl:
      typeof authUser.user_metadata?.avatar_url === "string" ? authUser.user_metadata.avatar_url : undefined
  };
}

export async function syncAuthUserProfile(authUser: SupabaseAuthUser) {
  const data = authUserProfile(authUser);
  const avatarUrl =
    data.avatarUrl ||
    (typeof authUser.user_metadata?.picture === "string" ? authUser.user_metadata.picture : undefined);

  return prisma.$transaction(async (tx) => {
    const existingByAuth = await tx.user.findUnique({
      where: { authUserId: authUser.id }
    });

    if (existingByAuth) {
      return tx.user.update({
        where: { id: existingByAuth.id },
        data: {
          email: data.email,
          fullName: data.fullName,
          avatarUrl
        }
      });
    }

    const existingByEmail = await tx.user.findUnique({
      where: { email: data.email }
    });

    if (existingByEmail) {
      return tx.user.update({
        where: { id: existingByEmail.id },
        data: {
          authUserId: authUser.id,
          fullName: data.fullName,
          avatarUrl
        }
      });
    }

    return tx.user.create({
      data: {
        authUserId: authUser.id,
        email: data.email,
        fullName: data.fullName,
        avatarUrl
      }
    });
  });
}

export async function getRequestContext(request?: Request): Promise<RequestContext> {
  const supabase = await createSupabaseServerClient();
  const auth = supabase ? await supabase.auth.getUser() : null;
  const authUser = auth?.data.user;

  if (!authUser) {
    throw new RequestContextError("Authentication required.", 401);
  }

  if (authUser) {
    try {
      const profile = await syncAuthUserProfile(authUser);

      const requestedWorkspace = await getRequestedWorkspaceId(request);
      const requestedMembership = requestedWorkspace
        ? await prisma.workspaceMember.findFirst({
            where: { userId: profile.id, workspaceId: requestedWorkspace },
            orderBy: { createdAt: "asc" }
          })
        : null;
      const membership =
        requestedMembership ??
        await prisma.workspaceMember.findFirst({
          where: { userId: profile.id },
          orderBy: { createdAt: "asc" }
        });

      if (membership) {
        return {
          workspaceId: membership.workspaceId,
          userId: profile.id,
          role: membership.role,
          authUserId: authUser.id
        };
      }

      throw new RequestContextError("Workspace onboarding required.", 409);
    } catch (error) {
      if (error instanceof RequestContextError) {
        throw error;
      }
      if (process.env.NODE_ENV === "production") {
        throw new Error("Database is unavailable for authenticated workspace context.");
      }
      throw new RequestContextError("Workspace context could not be resolved.", 500);
    }
  }

  throw new RequestContextError("Authentication required.", 401);
}

async function getRequestedWorkspaceId(request?: Request) {
  const headerWorkspace = request?.headers.get("x-workspace-id");
  if (headerWorkspace) return headerWorkspace;

  const cookieHeader = request?.headers.get("cookie");
  const requestCookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("workspace_id="))
    ?.split("=")[1];
  if (requestCookie) return decodeURIComponent(requestCookie);

  try {
    return (await cookies()).get("workspace_id")?.value;
  } catch {
    return undefined;
  }
}

export function assertCanWrite(context: RequestContext) {
  if (!["owner", "admin", "editor"].includes(context.role)) {
    throw new Error("This action requires owner, admin, or editor permissions.");
  }
}

export function assertCanAdminWorkspace(context: RequestContext) {
  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("This action requires owner or admin permissions.");
  }
}

export function assertCanReview(context: RequestContext) {
  if (!["owner", "admin", "editor", "reviewer"].includes(context.role)) {
    throw new Error("This action requires review permissions.");
  }
}
