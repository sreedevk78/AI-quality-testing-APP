import type { ProviderName } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";
import { SecretService } from "@/server/services/secret-service";

export type ProviderCredentialView = {
  id: string;
  provider: ProviderName;
  displayName: string;
  status: "active" | "disabled" | "rotated";
  lastUsedAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ProviderCredentialService {
  private readonly secrets = new SecretService();
  private readonly events = new EventService();

  async list(context: RequestContext): Promise<ProviderCredentialView[]> {
    const rows = await prisma.providerCredential.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      provider: row.provider as ProviderName,
      displayName: row.displayName,
      status: row.status,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      rotatedAt: row.rotatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async save(
    context: RequestContext,
    input: { provider: ProviderName; displayName?: string; secret: string }
  ): Promise<ProviderCredentialView> {
    const displayName = input.displayName?.trim() || "default";
    const encrypted = this.secrets.encrypt(input.secret);
    const existing = await prisma.providerCredential.findUnique({
      where: { workspaceId_provider_displayName: { workspaceId: context.workspaceId, provider: input.provider, displayName } }
    });

    const credential = await prisma.providerCredential.upsert({
      where: { workspaceId_provider_displayName: { workspaceId: context.workspaceId, provider: input.provider, displayName } },
      update: {
        encryptedSecretRef: encrypted,
        status: "active",
        rotatedAt: new Date()
      },
      create: {
        workspaceId: context.workspaceId,
        provider: input.provider,
        displayName,
        encryptedSecretRef: encrypted,
        createdBy: context.userId
      }
    });

    await this.events.emit(context, {
      entityType: "provider_credential",
      entityId: credential.id,
      action: existing ? "provider_credential_rotated" : "provider_credential_created",
      payload: { provider: credential.provider, displayName: credential.displayName }
    });

    return {
      id: credential.id,
      provider: credential.provider as ProviderName,
      displayName: credential.displayName,
      status: credential.status,
      lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
      rotatedAt: credential.rotatedAt?.toISOString() ?? null,
      createdAt: credential.createdAt.toISOString(),
      updatedAt: credential.updatedAt.toISOString()
    };
  }

  async revoke(context: RequestContext, credentialId: string) {
    const credential = await prisma.providerCredential.update({
      where: { id: credentialId, workspaceId: context.workspaceId },
      data: { status: "disabled" }
    });

    await this.events.emit(context, {
      entityType: "provider_credential",
      entityId: credential.id,
      action: "provider_credential_revoked",
      payload: { provider: credential.provider, displayName: credential.displayName }
    });

    return { id: credential.id, status: credential.status };
  }

  async resolveSecret(context: Pick<RequestContext, "workspaceId">, provider: ProviderName) {
    const credential = await prisma.providerCredential.findFirst({
      where: { workspaceId: context.workspaceId, provider, status: "active" },
      orderBy: { updatedAt: "desc" }
    });

    if (!credential) return null;

    await prisma.providerCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() }
    });

    return this.secrets.decrypt(credential.encryptedSecretRef);
  }
}
