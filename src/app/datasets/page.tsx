import { DatabaseZap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { getDatasetPageData, getFirstProjectId } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { DatasetToolbar, AddCaseButton } from "@/components/datasets/dataset-toolbar";
import { InlineCaseEditor, DatasetSnapshotButton } from "@/components/datasets/case-editor";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  const context = await getPageRequestContext();
  const [datasets, projectId] = await Promise.all([
    getDatasetPageData(context.workspaceId),
    getFirstProjectId(context.workspaceId),
  ]);
  const dataset = datasets[0];

  return (
    <AppShell>
      <PageTitle
        title="Dataset manager"
        description="Curate test suites with expected behavior, rubrics, tags, CSV import mapping, and version snapshots."
        action={<DatasetToolbar projectId={projectId} datasetId={dataset?.id} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <SectionCard 
          title="Active suite"
          action={dataset && <DatasetSnapshotButton datasetId={dataset.id} />}
        >
          {dataset ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{dataset.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">v{dataset.version} / {formatPercent(dataset.coverage)} coverage</p>
                </div>
                <StatusBadge status={dataset.status} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-3 font-medium">Case</th>
                      <th className="pb-3 font-medium">Expected behavior</th>
                      <th className="pb-3 font-medium">Difficulty</th>
                      <th className="pb-3 font-medium">Tags</th>
                      <th className="pb-3 font-medium px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dataset.cases.map((item) => (
                      <InlineCaseEditor key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
              <h2 className="font-semibold">No datasets yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Import a CSV or create the first suite before queueing an evaluation run.</p>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Case drawer">
          <div className="space-y-4">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/15 text-primary">
              <DatabaseZap size={22} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Add structured cases</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Capture input payload, expected output, rubric JSON, tags, difficulty, source reference, and active state.
              </p>
            </div>
            {dataset && <AddCaseButton datasetId={dataset.id} />}
            <a href="/runs" className="focus-ring block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">Run Dataset</a>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
