import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { getPageRequestContext } from "@/server/page-context";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getAuditLogs(workspaceId: string, page = 1) {
  const pageSize = 50;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { user: { select: { email: true } } }
    }),
    prisma.auditLog.count({ where: { workspaceId } })
  ]);

  return { logs, totalPages: Math.ceil(total / pageSize) };
}

export default async function AuditLogsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const context = await getPageRequestContext();
  const { logs, totalPages } = await getAuditLogs(context.workspaceId, page);

  return (
    <AppShell>
      <PageTitle 
        title="Audit Logs" 
        description="History of all critical actions performed in this workspace."
      />
      <SectionCard 
        title="Recent Activity"
        action={totalPages > 1 && (
            <div className="flex items-center gap-4 text-sm">
                <Link 
                  href={`/analytics/audit-logs?page=${Math.max(1, page - 1)}`}
                  className={`focus-ring rounded border border-border px-2 py-1 ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                >
                    Prev
                </Link>
                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                <Link 
                  href={`/analytics/audit-logs?page=${Math.min(totalPages, page + 1)}`}
                  className={`focus-ring rounded border border-border px-2 py-1 ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                >
                    Next
                </Link>
            </div>
        )}
      >
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
                    {formatRelativeTime(log.createdAt)}
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

function formatRelativeTime(date: Date) {
  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1]
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const [unit, secondsPerUnit] = units.find(([, seconds]) => elapsedSeconds >= seconds) ?? ["second", 1];
  return formatter.format(-Math.floor(elapsedSeconds / secondsPerUnit), unit);
}
