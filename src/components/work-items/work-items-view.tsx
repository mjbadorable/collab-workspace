"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ListChecks, Plus, Trash2 } from "lucide-react";
import { initials, mockProjects, mockUser } from "@/lib/mock-data";
import { useIsClient } from "@/lib/use-is-client";
import {
  addWorkItem,
  loadWorkItems,
  projectIdentifier,
  saveWorkItems,
  softDeleteWorkItem,
  updateWorkItem,
  workItemKey,
  type NewWorkItemInput,
  type StoredWorkItem,
  type WorkItemPriority,
  type WorkItemStatus,
} from "@/lib/work-items-storage";
import { useNewWorkItem } from "./new-work-item-context";

type Filter = "all" | WorkItemStatus;

const statusOptions: { value: WorkItemStatus; label: string; tone: string }[] = [
  { value: "backlog", label: "Backlog", tone: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  { value: "in_progress", label: "In Progress", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
];

const priorityOptions: { value: WorkItemPriority; label: string; tone: string; dot: string }[] = [
  { value: "low", label: "Low", tone: "border-neutral-200 text-neutral-600", dot: "bg-neutral-400" },
  { value: "medium", label: "Medium", tone: "border-blue-200 text-blue-700", dot: "bg-blue-500" },
  { value: "high", label: "High", tone: "border-red-200 text-red-700", dot: "bg-red-500" },
];

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...statusOptions.map(({ value, label }) => ({ value, label })),
];

function PillSelect<T extends string>({
  value,
  options,
  label,
  onChange,
  prefix,
}: {
  value: T;
  options: { value: T; label: string; tone: string }[];
  label: string;
  onChange: (next: T) => void;
  prefix?: ReactNode;
}) {
  const tone = options.find((o) => o.value === value)?.tone ?? "";
  return (
    <span className={`relative inline-flex items-center rounded-full border text-xs font-medium ${tone}`}>
      {prefix}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`cursor-pointer appearance-none rounded-full bg-transparent py-0.5 pr-2.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          prefix ? "pl-1" : "pl-2.5"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function WorkItemRow({
  item,
  projectId,
  onChange,
  onDelete,
}: {
  item: StoredWorkItem;
  projectId: string;
  onChange: (patch: Partial<StoredWorkItem>) => void;
  onDelete: () => void;
}) {
  const key = workItemKey(projectId, item.seq);
  const mine = item.assignee_id === mockUser.id;
  const priority = priorityOptions.find((p) => p.value === item.priority)!;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-100 px-4 py-2 hover:bg-neutral-50">
      <span className="w-16 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-600">
        {key}
      </span>
      <div className="min-w-48 flex-1">
        <p className={`truncate text-sm ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>
          {item.title}
        </p>
        {item.description && <p className="truncate text-xs text-neutral-500">{item.description}</p>}
      </div>
      <PillSelect
        label={`Status of ${key}`}
        value={item.status}
        options={statusOptions}
        onChange={(status) => onChange({ status })}
      />
      <PillSelect
        label={`Priority of ${key}`}
        value={item.priority}
        options={priorityOptions}
        onChange={(p) => onChange({ priority: p })}
        prefix={<span className={`ml-2 h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden />}
      />
      <button
        type="button"
        onClick={() => onChange({ assignee_id: mine ? null : mockUser.id })}
        title={mine ? `Assigned to ${mockUser.name} (click to unassign)` : "Unassigned (click to assign to me)"}
        aria-label={mine ? `Unassign ${key}` : `Assign ${key} to me`}
        className="w-24 shrink-0 text-left"
      >
        {mine ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
            {initials(mockUser.name)}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100">
            Unassigned
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Move ${key} to trash`}
        title="Move to trash"
        className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function NewItemForm({
  projectKey,
  onSubmit,
  onCancel,
}: {
  projectKey: string;
  onSubmit: (input: NewWorkItemInput) => void;
  onCancel: () => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return;
    onSubmit({
      title,
      description: String(f.get("description") ?? ""),
      status: f.get("status") as WorkItemStatus,
      priority: f.get("priority") as WorkItemPriority,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{projectKey}</span>
        <h2 className="text-base font-semibold">New work item</h2>
      </div>
      <div>
        <label htmlFor="wi-title" className="mb-1 block text-xs font-medium text-neutral-600">
          Title
        </label>
        <input id="wi-title" name="title" required autoFocus maxLength={200} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="wi-description" className="mb-1 block text-xs font-medium text-neutral-600">
          Description <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea id="wi-description" name="description" rows={3} className={`${fieldClass} resize-none`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-status" className="mb-1 block text-xs font-medium text-neutral-600">
            Status
          </label>
          <select id="wi-status" name="status" defaultValue="backlog" className={fieldClass}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wi-priority" className="mb-1 block text-xs font-medium text-neutral-600">
            Priority
          </label>
          <select id="wi-priority" name="priority" defaultValue="medium" className={fieldClass}>
            {priorityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create work item
        </button>
      </div>
    </form>
  );
}

function WorkItems({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<StoredWorkItem[]>(() => loadWorkItems(projectId));
  const [filter, setFilter] = useState<Filter>("all");
  const { open, openDialog, closeDialog } = useNewWorkItem();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => saveWorkItems(projectId, items), [projectId, items]);

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const live = items.filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);
  const visible = filter === "all" ? live : live.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === "all" ? live.length : live.filter((i) => i.status === f).length);
  const projectName = mockProjects.find((p) => p.id === projectId)?.name ?? projectId;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2 text-sm">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-neutral-500">
          <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{projectName}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-neutral-900">Work items</span>
        </nav>
        <button
          type="button"
          onClick={openDialog}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New work item
        </button>
      </header>

      <div role="tablist" aria-label="Filter by status" className="flex gap-1 border-b border-neutral-200 px-4 py-2">
        {filters.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${
                active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f.label}
              <span className="rounded-full bg-white px-1.5 text-xs text-neutral-500 ring-1 ring-neutral-200">
                {count(f.value)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <ListChecks className="h-8 w-8 text-neutral-400" />
            <p className="mt-3 text-sm font-medium">{filter === "all" ? "No work items yet" : "Nothing here"}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {filter === "all" ? "Press C or use New work item to add one." : "No work items match this filter."}
            </p>
          </div>
        ) : (
          <ul>
            {visible.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                projectId={projectId}
                onChange={(patch) => setItems((prev) => updateWorkItem(prev, item.id, patch))}
                onDelete={() => setItems((prev) => softDeleteWorkItem(prev, item.id))}
              />
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={closeDialog}
        onClick={(e) => e.target === e.currentTarget && closeDialog()}
        aria-label="New work item"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {open && (
          <NewItemForm
            projectKey={projectIdentifier(projectId)}
            onCancel={closeDialog}
            onSubmit={(input) => {
              setItems((prev) => addWorkItem(prev, projectId, input));
              setFilter("all");
              closeDialog();
            }}
          />
        )}
      </dialog>
    </div>
  );
}

export default function WorkItemsView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  return mounted ? <WorkItems projectId={projectId} /> : <div className="h-full" />;
}
