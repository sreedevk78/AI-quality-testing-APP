import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { getPageRequestContext } from "@/server/page-context";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

async function getAuditLogs(workspaceId: string) {
  return prisma.auditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true } } }
  });
}

export default async function AuditLogsPage() {
  const context = await getPageRequestContext();
  const logs = await getAuditLogs(context.workspaceId);

  return (
    <AppShell>
      <PageTitle 
        title="Audit Logs" 
        description="History of all critical actions performed in this workspace."
      />
      <SectionCard title="Recent Activity">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Entity</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No logs found.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 font-medium">{log.user?.email ?? "System"}</td>
                  <td className="py-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{log.action}</span>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {log.entityType} ({log.entityId.slice(0, 8)})
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
