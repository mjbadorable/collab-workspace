"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { parseDescription } from "@/lib/checklist";
import { createModule, getModules, type ProjectModule } from "@/lib/modules";
import { useProfile } from "@/lib/profile-context";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";
import { workItemKey, type StoredWorkItem, type WorkItemStatus } from "@/lib/work-items-storage";
import { ProjectNotFound } from "./project-overview";
import WorkItemsSource from "./work-items-source";

const MAX_TICKETS = 6;

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// A work item is in a module when the module lists its ticket key or the item is tagged [module: name].
function itemsOfModule(projectId: string, module: ProjectModule, items: StoredWorkItem[]): StoredWorkItem[] {
  return items.filter(
    (i) => module.ticketKeys.includes(workItemKey(projectId, i.seq)) || parseDescription(i.description).module === module.name
  );
}

function ModuleCard({ projectId, module, items }: { projectId: string; module: ProjectModule; items: StoredWorkItem[] }) {
  const done = items.filter((i) => i.status === "done").length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const shown = items.slice(0, MAX_TICKETS);

  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xl" aria-hidden>
          {module.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{module.name}</h2>
          {module.lead && (
            <span className="mt-1 inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              Lead: {module.lead}
            </span>
          )}
        </div>
      </div>
      {module.description && <p className="mt-3 text-sm text-neutral-500">{module.description}</p>}

      <div className="mt-4">
        <div
          role="progressbar"
          aria-label={`${module.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 overflow-hidden rounded-full bg-neutral-100"
        >
          <div className="h-full rounded-full bg-linear-to-r from-red-500 to-amber-400" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {done}/{items.length} tasks completed · {percent}%
        </p>
      </div>

      {shown.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {shown.map((i) => (
            <li key={i.id}>
              <Link href={`/projects/${projectId}/work-items`} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-neutral-50">
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-600">{workItemKey(projectId, i.seq)}</span>
                <span className={`min-w-0 flex-1 truncate ${i.status === "done" ? "text-neutral-400 line-through" : "text-neutral-700"}`}>{i.title}</span>
                <span className="shrink-0 text-neutral-500">{STATUS_LABEL[i.status]}</span>
              </Link>
            </li>
          ))}
          {items.length > shown.length && <li className="px-1 text-xs text-neutral-500">+{items.length - shown.length} more</li>}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">No tickets linked yet.</p>
      )}
    </li>
  );
}

function NewModuleDialog({
  open,
  defaultLead,
  onClose,
  onCreate,
}: {
  open: boolean;
  defaultLead: string;
  onClose: () => void;
  onCreate: (input: { name: string; description: string; icon: string; lead: string; ticketKeys: string[] }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return setError("Give the module a name.");
    const ticketKeys = String(f.get("tickets") ?? "")
      .split(/[\s,]+/)
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);
    onCreate({
      name,
      description: String(f.get("description") ?? ""),
      icon: String(f.get("icon") ?? ""),
      lead: String(f.get("lead") ?? ""),
      ticketKeys,
    });
    setError(null);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="New module"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <h2 className="text-base font-semibold">New module</h2>
          <div className="grid grid-cols-[4rem_1fr] gap-3">
            <div>
              <label htmlFor="md-icon" className="mb-1 block text-xs font-medium text-neutral-600">Icon</label>
              <input id="md-icon" name="icon" maxLength={4} defaultValue="📦" className={`${fieldClass} text-center`} />
            </div>
            <div>
              <label htmlFor="md-name" className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
              <input id="md-name" name="name" required autoFocus maxLength={80} placeholder="Billing & Invoices" className={fieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor="md-desc" className="mb-1 block text-xs font-medium text-neutral-600">Description <span className="font-normal text-neutral-400">(optional)</span></label>
            <textarea id="md-desc" name="description" rows={2} className={`${fieldClass} resize-none`} />
          </div>
          <div>
            <label htmlFor="md-lead" className="mb-1 block text-xs font-medium text-neutral-600">Lead</label>
            <input id="md-lead" name="lead" defaultValue={defaultLead} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="md-tickets" className="mb-1 block text-xs font-medium text-neutral-600">Tickets <span className="font-normal text-neutral-400">(keys, comma separated)</span></label>
            <input id="md-tickets" name="tickets" placeholder="CW-1, CW-3" className={`${fieldClass} font-mono`} />
            <p className="mt-1 text-xs text-neutral-500">You can also tag any work item with this module when you edit it.</p>
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">Cancel</button>
            <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Create module</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Modules({ projectId, items }: { projectId: string; items: StoredWorkItem[] | null }) {
  const { displayName } = useProfile();
  const [modules, setModules] = useState<ProjectModule[]>(() => getModules(projectId));
  const [creating, setCreating] = useState(false);
  const live = (items ?? []).filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
          <Plus className="h-4 w-4" aria-hidden /> New Module
        </button>
      </div>
      {items === null ? (
        <p className="py-8 text-center text-sm text-neutral-500">Loading work items…</p>
      ) : modules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
          No modules yet. Create one to group related work into a feature epic.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {modules.map((m) => (
            <ModuleCard key={m.id} projectId={projectId} module={m} items={itemsOfModule(projectId, m, live)} />
          ))}
        </ul>
      )}
      <NewModuleDialog
        open={creating}
        defaultLead={displayName}
        onClose={() => setCreating(false)}
        onCreate={(input) => setModules(createModule(projectId, input))}
      />
    </>
  );
}

export default function ModulesView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
        <span aria-hidden>›</span>
        <Link href={`/projects/${project.id}`} className="hover:text-neutral-900">{project.name}</Link>
        <span aria-hidden>›</span>
        <span className="text-neutral-900">Modules</span>
      </nav>
      <h1 className="mb-1 text-xl font-semibold">Modules</h1>
      <p className="mb-6 text-sm text-neutral-500">Group related work into functional feature epics and track each one&apos;s progress.</p>
      {/* Remounted per project so the module list never shows another project's data. */}
      <WorkItemsSource key={project.id} projectId={project.id} fallback={<div className="h-64" />}>
        {({ items }) => <Modules projectId={project.id} items={items} />}
      </WorkItemsSource>
    </div>
  );
}
