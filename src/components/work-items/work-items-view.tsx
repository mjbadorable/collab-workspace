"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Kanban, List, ListChecks, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { initials, mockUser } from "@/lib/mock-data";
import { getProjects } from "@/lib/projects";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import {
  projectIdentifier,
  workItemKey,
  type NewWorkItemInput,
  type StoredWorkItem,
  type WorkItemPriority,
  type WorkItemStatus,
} from "@/lib/work-items-storage";
import { useNewWorkItem } from "./new-work-item-context";

type Filter = "all" | WorkItemStatus;
type ViewMode = "list" | "board";

const VIEW_KEY = "collab-workspace:work-items-view";

const viewOptions: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: Kanban },
];

export const statusOptions: { value: WorkItemStatus; label: string; tone: string }[] = [
  { value: "backlog", label: "Backlog", tone: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  { value: "in_progress", label: "In Progress", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
];

export const priorityOptions: { value: WorkItemPriority; label: string; tone: string; dot: string }[] = [
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

type Me = { id: string; name: string };

function WorkItemRow({
  item,
  projectId,
  me,
  onChange,
  onEdit,
  onDelete,
}: {
  item: StoredWorkItem;
  projectId: string;
  me: Me;
  onChange: (patch: Partial<StoredWorkItem>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const key = workItemKey(projectId, item.seq);
  const mine = item.assignee_id === me.id;
  const priority = priorityOptions.find((p) => p.value === item.priority)!;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-100 px-4 py-2 hover:bg-neutral-50">
      <span className="w-16 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-600">
        {key}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${key}`}
        className="min-w-48 flex-1 cursor-pointer text-left"
      >
        <p className={`truncate text-sm ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>
          {item.title}
        </p>
        {item.description && <p className="truncate text-xs text-neutral-500">{item.description}</p>}
      </button>
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
        onClick={() => onChange({ assignee_id: mine ? null : me.id })}
        title={mine ? `Assigned to ${me.name} (click to unassign)` : "Unassigned (click to assign to me)"}
        aria-label={mine ? `Unassign ${key}` : `Assign ${key} to me`}
        className="w-24 shrink-0 text-left"
      >
        {mine ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
            {initials(me.name)}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100">
            Unassigned
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${key} details`}
        title="Edit"
        className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <Pencil className="h-4 w-4" />
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

const columnDot: Record<WorkItemStatus, string> = {
  backlog: "bg-neutral-400",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
};

function BoardCard({
  item,
  projectId,
  me,
  onChange,
  onEdit,
  onDelete,
}: {
  item: StoredWorkItem;
  projectId: string;
  me: Me;
  onChange: (patch: Partial<StoredWorkItem>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const key = workItemKey(projectId, item.seq);
  const mine = item.assignee_id === me.id;
  const priority = priorityOptions.find((p) => p.value === item.priority)!;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{key}</span>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${key} details`}
            title="Edit"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Move ${key} to trash`}
            title="Move to trash"
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${key}`} className="mt-2 block w-full cursor-pointer text-left">
        <p className={`text-sm font-medium ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>
          {item.title}
        </p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{item.description}</p>}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${priority.tone}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden />
          {priority.label}
        </span>
        {/* Keyboard / touch alternative to dragging. */}
        <PillSelect
          label={`Move ${key} to column`}
          value={item.status}
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />
        <button
          type="button"
          onClick={() => onChange({ assignee_id: mine ? null : me.id })}
          title={mine ? `Assigned to ${me.name} (click to unassign)` : "Unassigned (click to assign to me)"}
          aria-label={mine ? `Unassign ${key}` : `Assign ${key} to me`}
          className="ml-auto"
        >
          {mine ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
              {initials(me.name)}
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100">
              Unassigned
            </span>
          )}
        </button>
      </div>
    </li>
  );
}

function KanbanBoard({
  items,
  projectId,
  me,
  onChange,
  onEdit,
  onDelete,
  onQuickAdd,
}: {
  items: StoredWorkItem[];
  projectId: string;
  me: Me;
  onChange: (id: string, patch: Partial<StoredWorkItem>) => void;
  onEdit: (item: StoredWorkItem) => void;
  onDelete: (id: string) => void;
  onQuickAdd: (status: WorkItemStatus) => void;
}) {
  const [dragOver, setDragOver] = useState<WorkItemStatus | null>(null);

  const handleDragOver = (e: DragEvent<HTMLElement>, status: WorkItemStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== status) setDragOver(status);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, status: WorkItemStatus) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const item = items.find((i) => i.id === id);
    if (item && item.status !== status) onChange(id, { status });
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {statusOptions.map((col) => {
        const cards = items.filter((i) => i.status === col.value);
        return (
          <section
            key={col.value}
            aria-label={col.label}
            onDragOver={(e) => handleDragOver(e, col.value)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
            }}
            onDrop={(e) => handleDrop(e, col.value)}
            className={`flex min-w-[280px] flex-1 flex-col rounded-lg border bg-neutral-50 transition-colors ${
              dragOver === col.value ? "border-indigo-400 bg-indigo-50/60" : "border-neutral-200"
            }`}
          >
            <header className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
              <span className={`h-2 w-2 rounded-full ${columnDot[col.value]}`} aria-hidden />
              {col.label}
              <span className="rounded-full bg-white px-1.5 text-xs font-normal text-neutral-500 ring-1 ring-neutral-200">
                {cards.length}
              </span>
            </header>
            <ul className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {cards.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  projectId={projectId}
                  me={me}
                  onChange={(patch) => onChange(item.id, patch)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onQuickAdd(col.value)}
              className="m-2 mt-0 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add to {col.label}
            </button>
          </section>
        );
      })}
    </div>
  );
}

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// Shared by the "New work item" and "Edit Work Item" dialogs; `initial` pre-fills it for editing.
function ItemForm({
  projectKey,
  heading,
  submitLabel,
  initial,
  defaultStatus,
  onSubmit,
  onCancel,
}: {
  projectKey: string;
  heading: string;
  submitLabel: string;
  initial?: StoredWorkItem;
  defaultStatus?: WorkItemStatus;
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
        <h2 className="text-base font-semibold">{heading}</h2>
      </div>
      <div>
        <label htmlFor="wi-title" className="mb-1 block text-xs font-medium text-neutral-600">
          Title
        </label>
        <input
          id="wi-title"
          name="title"
          required
          autoFocus
          maxLength={200}
          defaultValue={initial?.title}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="wi-description" className="mb-1 block text-xs font-medium text-neutral-600">
          Description <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="wi-description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          className={`${fieldClass} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-status" className="mb-1 block text-xs font-medium text-neutral-600">
            Status
          </label>
          <select id="wi-status" name="status" defaultValue={initial?.status ?? defaultStatus ?? "backlog"} className={fieldClass}>
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
          <select id="wi-priority" name="priority" defaultValue={initial?.priority ?? "medium"} className={fieldClass}>
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
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function WorkItems({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const { items: allItems, error, add, update, softDelete } = useWorkItems(projectId, workspaceId);
  const items = allItems ?? [];
  const [filter, setFilter] = useState<Filter>("all");
  const { open, openDialog, closeDialog } = useNewWorkItem();
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [editingItem, setEditingItem] = useState<StoredWorkItem | null>(null);
  // The board's per-column "Add" buttons pre-select that column's status in the new-item dialog.
  const [presetStatus, setPresetStatus] = useState<WorkItemStatus>("backlog");
  // The component only renders on the client (see WorkItemsView), so reading localStorage here is safe.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  });
  const chooseView = (next: ViewMode) => {
    setViewMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage blocked: the choice just won't persist
    }
  };
  // In the cloud, assignees are real auth users; local preview keeps the mock user.
  const me: Me =
    workspaceId && user ? { id: user.id, name: (user.email ?? "Me").split("@")[0].replace(/[._-]+/g, " ") } : mockUser;

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editingItem && !dialog.open) dialog.showModal();
    if (!editingItem && dialog.open) dialog.close();
  }, [editingItem]);

  const live = items.filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);
  const visible = filter === "all" ? live : live.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === "all" ? live.length : live.filter((i) => i.status === f).length);
  const projectName = getProjects().find((p) => p.id === projectId)?.name ?? projectId;

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
        <div className="flex shrink-0 items-center gap-3">
          <div role="group" aria-label="View" className="flex rounded-md bg-neutral-100 p-0.5">
            {viewOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={viewMode === value}
                onClick={() => chooseView(value)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${
                  viewMode === value ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openDialog}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New work item
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {viewMode === "list" && (
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
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {allItems === null ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500">Loading work items…</p>
        ) : viewMode === "board" ? (
          <KanbanBoard
            items={live}
            projectId={projectId}
            me={me}
            onChange={update}
            onEdit={setEditingItem}
            onDelete={softDelete}
            onQuickAdd={(status) => {
              setPresetStatus(status);
              openDialog();
            }}
          />
        ) : visible.length === 0 ? (
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
                me={me}
                onChange={(patch) => update(item.id, patch)}
                onEdit={() => setEditingItem(item)}
                onDelete={() => softDelete(item.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => {
          closeDialog();
          setPresetStatus("backlog");
        }}
        onClick={(e) => e.target === e.currentTarget && closeDialog()}
        aria-label="New work item"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {open && (
          <ItemForm
            projectKey={projectIdentifier(projectId)}
            heading="New work item"
            submitLabel="Create work item"
            defaultStatus={presetStatus}
            onCancel={closeDialog}
            onSubmit={(input) => {
              add(input);
              setFilter("all");
              closeDialog();
            }}
          />
        )}
      </dialog>

      <dialog
        ref={editDialogRef}
        onClose={() => setEditingItem(null)}
        onClick={(e) => e.target === e.currentTarget && setEditingItem(null)}
        aria-label="Edit Work Item"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {editingItem && (
          <ItemForm
            key={editingItem.id}
            projectKey={workItemKey(projectId, editingItem.seq)}
            heading="Edit Work Item"
            submitLabel="Save changes"
            initial={editingItem}
            onCancel={() => setEditingItem(null)}
            onSubmit={(input) => {
              update(editingItem.id, {
                title: input.title.trim(),
                description: input.description.trim() || null,
                status: input.status,
                priority: input.priority,
              });
              setEditingItem(null);
            }}
          />
        )}
      </dialog>
    </div>
  );
}

export default function WorkItemsView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <div className="h-full" />;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return <WorkItems key={workspaceId ?? "local"} projectId={projectId} workspaceId={workspaceId} />;
}
