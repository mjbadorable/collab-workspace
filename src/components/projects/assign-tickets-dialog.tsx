"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { workItemKey, type StoredWorkItem, type WorkItemStatus } from "@/lib/work-items-storage";

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };

// Lists every ticket in the project with a checkbox. Each click is applied at once through `onToggle`, so there is
// nothing to save. `note` adds a small hint to a row (for example, "in Cycle 2 by date").
export default function AssignTicketsDialog({
  open,
  onClose,
  title,
  projectId,
  items,
  isAssigned,
  note,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  projectId: string;
  items: StoredWorkItem[];
  isAssigned: (item: StoredWorkItem) => boolean;
  note?: (item: StoredWorkItem) => string | null;
  onToggle: (item: StoredWorkItem, assigned: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const live = items.filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);
  const assignedCount = live.filter(isAssigned).length;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className="m-auto w-full max-w-lg rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-xs text-neutral-500">
                {assignedCount} of {live.length} tickets assigned. Changes apply as you click.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
              <X className="h-4 w-4" />
            </button>
          </header>
          {live.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">This project has no work items yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 overflow-y-auto">
              {live.map((item) => {
                const key = workItemKey(projectId, item.seq);
                const hint = note?.(item) ?? null;
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-2 text-sm hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={isAssigned(item)}
                        onChange={(e) => onToggle(item, e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-red-600"
                      />
                      <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{key}</span>
                      <span className={`min-w-0 flex-1 truncate ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>{item.title}</span>
                      {hint && <span className="shrink-0 text-[11px] text-neutral-400">{hint}</span>}
                      <span className="shrink-0 text-xs text-neutral-500">{STATUS_LABEL[item.status]}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="flex justify-end border-t border-neutral-200 px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              Done
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
