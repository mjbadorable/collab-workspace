"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, RotateCcw, X } from "lucide-react";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { parseDescription } from "@/lib/checklist";
import { loadWorkItems, workItemKey, type WorkItemStatus } from "@/lib/work-items-storage";

const runbookKey = (projectId: string, nodeId: string) => `collab-workspace:runbook:${projectId}:${nodeId}`;

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };
const MAX_LINKED = 6;
// Too generic to say a work item is about a node.
const STOP_WORDS = new Set(["with", "from", "that", "this", "into", "and", "the", "for", "layer", "data", "flow", "step"]);

function readRunbook(projectId: string, nodeId: string): string | null {
  try {
    return localStorage.getItem(runbookKey(projectId, nodeId));
  } catch {
    return null;
  }
}

const keywordsOf = (title: string) =>
  [...new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w)))];

// Documentation panel for one architecture layer or flowchart step: editable runbook notes (kept on this device)
// and the project's work items that mention the same keywords. Mount it only while a node is selected.
export default function NodeInspector({
  projectId,
  nodeId,
  nodeTitle,
  nodeKind,
  defaultNotes = "",
  onClose,
}: {
  projectId: string;
  nodeId: string;
  nodeTitle: string;
  nodeKind: string;
  defaultNotes?: string;
  onClose: () => void;
}) {
  const { openDialogWithTitle } = useNewWorkItem();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [edited, setEdited] = useState<string | null>(() => readRunbook(projectId, nodeId));
  const notes = edited ?? defaultNotes;

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const linked = useMemo(() => {
    const words = keywordsOf(nodeTitle);
    if (words.length === 0) return [];
    return loadWorkItems(projectId)
      .filter((i) => !i.deleted_at)
      .map((item) => {
        const text = `${item.title} ${parseDescription(item.description).notes}`.toLowerCase();
        return { item, hits: words.filter((w) => text.includes(w)).length };
      })
      .filter((r) => r.hits > 0)
      .sort((a, b) => b.hits - a.hits || a.item.seq - b.item.seq)
      .slice(0, MAX_LINKED);
  }, [projectId, nodeTitle]);

  const save = (value: string) => {
    setEdited(value);
    try {
      localStorage.setItem(runbookKey(projectId, nodeId), value);
    } catch {
      // storage blocked: the notes stay for this session only
    }
  };

  const reset = () => {
    setEdited(null);
    try {
      localStorage.removeItem(runbookKey(projectId, nodeId));
    } catch {
      // nothing stored to remove
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={`Inspect ${nodeTitle}`}
      className="m-auto w-full max-w-xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">{nodeKind}</p>
            <h2 className="text-base font-semibold leading-snug">{nodeTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5">
          <section>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="ni-runbook" className="text-sm font-semibold text-neutral-700">
                Engineering Runbook &amp; Technical Notes
              </label>
              {edited !== null && (
                <button type="button" onClick={reset} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800">
                  <RotateCcw className="h-3 w-3" aria-hidden /> Reset to default
                </button>
              )}
            </div>
            <textarea
              id="ni-runbook"
              value={notes}
              onChange={(e) => save(e.target.value)}
              rows={9}
              placeholder="Document edge cases, failure modes and how to recover…"
              className="mt-2 w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-2 font-mono text-xs leading-relaxed outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-neutral-500">Saved automatically on this device.</p>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-700">Linked work items</h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openDialogWithTitle(`${nodeTitle}: `, projectId);
                }}
                className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Plus className="h-3 w-3" aria-hidden /> New work item for this node
              </button>
            </div>
            {linked.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No work items mention this node yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {linked.map(({ item }) => (
                  <li key={item.id}>
                    <Link
                      href={`/projects/${projectId}/work-items`}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                    >
                      <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
                        {workItemKey(projectId, item.seq)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="shrink-0 text-xs text-neutral-500">{STATUS_LABEL[item.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
