"use client";

import { useState } from "react";
import { Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDatasetModal, AddCaseModal, ImportCsvModal } from "@/components/datasets/dataset-actions";

export function DatasetToolbar({ projectId, datasetId }: { projectId?: string; datasetId?: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addCaseOpen, setAddCaseOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New Dataset
        </Button>
        {datasetId && (
          <Button onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import CSV
          </Button>
        )}
      </div>
      <CreateDatasetModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={projectId} />
      {datasetId && (
        <>
          <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} datasetId={datasetId} />
          <AddCaseModal open={addCaseOpen} onClose={() => setAddCaseOpen(false)} datasetId={datasetId} />
        </>
      )}
    </>
  );
}

export function AddCaseButton({ datasetId }: { datasetId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>Add Case</Button>
      <AddCaseModal open={open} onClose={() => setOpen(false)} datasetId={datasetId} />
    </>
  );
}
