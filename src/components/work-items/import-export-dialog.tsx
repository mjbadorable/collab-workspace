"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileJson, FileSpreadsheet, Upload, X } from "lucide-react";
import { exportWorkItemsToCsv, exportWorkItemsToJson, parseWorkItemsCsv, parseWorkItemsJson } from "@/lib/import-export";
import type { NewWorkItemInput, StoredWorkItem } from "@/lib/work-items-storage";

const PREVIEW_ROWS = 8;

type Parsed = { fileName: string; inputs: NewWorkItemInput[] } | null;

function ImportExportBody({
  projectId,
  items,
  onImport,
  onClose,
}: {
  projectId: string;
  items: StoredWorkItem[];
  onImport: (inputs: NewWorkItemInput[]) => void;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<Parsed>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const live = items.filter((i) => !i.deleted_at);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setParsed(null);
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(text);
      const inputs = isJson ? parseWorkItemsJson(text) : parseWorkItemsCsv(text);
      if (inputs.length === 0) setError("No work items were found in that file.");
      else setParsed({ fileName: file.name, inputs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    void readFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="max-h-[85vh] space-y-5 overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Import / Export work items</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <section aria-label="Export">
        <h3 className="text-sm font-semibold text-neutral-700">Export</h3>
        <p className="mt-1 text-xs text-neutral-500">
          {live.length} work {live.length === 1 ? "item" : "items"} from this project.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={live.length === 0}
            onClick={() => exportWorkItemsToCsv(live, `${projectId}-work-items.csv`, projectId)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden /> Export to CSV
          </button>
          <button
            type="button"
            disabled={live.length === 0}
            onClick={() => exportWorkItemsToJson(live, `${projectId}-work-items.json`, projectId)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            <FileJson className="h-4 w-4 text-amber-600" aria-hidden /> Export to JSON
          </button>
        </div>
      </section>

      <section aria-label="Import">
        <h3 className="text-sm font-semibold text-neutral-700">Import</h3>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
            dragging ? "border-indigo-400 bg-indigo-50" : "border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          <Upload className="h-5 w-5 text-neutral-400" aria-hidden />
          <span className="font-medium">Drop a .csv or .json file here, or click to choose one</span>
          <span className="text-xs text-neutral-500">CSV needs a Title column; Status, Priority and Notes are optional.</span>
          <input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
        </label>

        {error && (
          <p role="alert" className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {parsed && (
          <div className="mt-3">
            <p className="text-sm font-medium">
              {parsed.inputs.length} {parsed.inputs.length === 1 ? "task" : "tasks"} found in {parsed.fileName}
            </p>
            <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-sm">
              {parsed.inputs.slice(0, PREVIEW_ROWS).map((t, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {t.status.replace("_", " ")} · {t.priority}
                  </span>
                </li>
              ))}
              {parsed.inputs.length > PREVIEW_ROWS && (
                <li className="px-3 py-1.5 text-xs text-neutral-500">+{parsed.inputs.length - PREVIEW_ROWS} more</li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => {
                onImport(parsed.inputs);
                onClose();
              }}
              className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Import {parsed.inputs.length} {parsed.inputs.length === 1 ? "Task" : "Tasks"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Export is one click; import previews what was found before anything is added.
export default function ImportExportDialog({
  open,
  onClose,
  projectId,
  items,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  items: StoredWorkItem[];
  onImport: (inputs: NewWorkItemInput[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Import or export work items"
      className="m-auto w-full max-w-lg rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounting the body only while open resets the file preview each time. */}
      {open && <ImportExportBody projectId={projectId} items={items} onImport={onImport} onClose={onClose} />}
    </dialog>
  );
}
