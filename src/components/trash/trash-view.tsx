"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Network, RotateCcw, Search, Trash2, type LucideIcon } from "lucide-react";
import { getProjects } from "@/lib/projects";
import { relativeTime } from "@/lib/relative-time";
import { supabase } from "@/lib/supabase";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import {
  fetchCloudDeletedDiagrams,
  loadDiagram,
  restoreCloudDiagram,
  restoreDiagram,
  saveDiagram,
} from "@/lib/diagram-storage";
import {
  fetchCloudWorkItemsForProjects,
  loadWorkItems,
  restoreWorkItem,
  saveWorkItems,
  updateCloudWorkItem,
  workItemKey,
} from "@/lib/work-items-storage";

type Filter = "all" | "work-item" | "diagram";

type TrashEntry = {
  id: string;
  kind: "work-item" | "diagram";
  projectId: string;
  projectName: string;
  key: string | null;
  title: string;
  deletedAt: string;
};

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "work-item", label: "Work items" },
  { value: "diagram", label: "Diagrams" },
];

const kindMeta: Record<TrashEntry["kind"], { label: string; icon: LucideIcon }> = {
  "work-item": { label: "Work item", icon: CheckSquare },
  diagram: { label: "Diagram", icon: Network },
};

const newestFirst = (entries: TrashEntry[]) => entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

function collectLocalTrash(): TrashEntry[] {
  const entries: TrashEntry[] = [];
  for (const project of getProjects()) {
    for (const item of loadWorkItems(project.id)) {
      if (!item.deleted_at) continue;
      entries.push({
        id: item.id,
        kind: "work-item",
        projectId: project.id,
        projectName: project.name,
        key: workItemKey(project.id, item.seq),
        title: item.title,
        deletedAt: item.deleted_at,
      });
    }
    const diagram = loadDiagram(project.id);
    if (diagram?.deleted_at) {
      entries.push({
        id: `diagram-${project.id}`,
        kind: "diagram",
        projectId: project.id,
        projectName: project.name,
        key: null,
        title: `${project.name} diagram`,
        deletedAt: diagram.deleted_at,
      });
    }
  }
  return newestFirst(entries);
}

// RLS limits every query to workspaces the user belongs to; the explicit workspace filter narrows it to the active one.
async function collectCloudTrash(workspaceId: string): Promise<TrashEntry[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const byId = new Map(projects.map((p) => [p.id, p]));
  const ids = projects.map((p) => p.id);
  // Keys depend on every item's rank in its project, so live items are fetched too.
  const [items, diagrams] = await Promise.all([fetchCloudWorkItemsForProjects(ids), fetchCloudDeletedDiagrams(ids)]);

  const entries: TrashEntry[] = [];
  for (const item of items) {
    const project = byId.get(item.project_id);
    if (!item.deleted_at || !project) continue;
    entries.push({
      id: item.id,
      kind: "work-item",
      projectId: project.id,
      projectName: project.name,
      key: `${project.identifier}-${item.seq}`,
      title: item.title,
      deletedAt: item.deleted_at,
    });
  }
  for (const diagram of diagrams) {
    const project = byId.get(diagram.project_id);
    if (!diagram.deleted_at || !project) continue;
    entries.push({
      id: diagram.id,
      kind: "diagram",
      projectId: project.id,
      projectName: project.name,
      key: null,
      title: diagram.name,
      deletedAt: diagram.deleted_at,
    });
  }
  return newestFirst(entries);
}

async function restoreLocal(entry: TrashEntry): Promise<void> {
  if (entry.kind === "work-item") {
    saveWorkItems(entry.projectId, restoreWorkItem(loadWorkItems(entry.projectId), entry.id));
    return;
  }
  const diagram = loadDiagram(entry.projectId);
  if (diagram) saveDiagram(entry.projectId, restoreDiagram(diagram));
}

async function restoreCloud(entry: TrashEntry): Promise<void> {
  if (entry.kind === "work-item") await updateCloudWorkItem(entry.id, { deleted_at: null });
  else await restoreCloudDiagram(entry.id);
}

function Trash({ workspaceId }: { workspaceId: string | null }) {
  // null = the cloud fetch is still in flight.
  const [entries, setEntries] = useState<TrashEntry[] | null>(() => (workspaceId ? null : collectLocalTrash()));
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    collectCloudTrash(workspaceId).then(
      (rows) => !cancelled && setEntries(rows),
      (e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the trash.");
        setEntries([]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const list = entries ?? [];
  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (!q || `${e.key ?? ""} ${e.title} ${e.projectName}`.toLowerCase().includes(q))
  );

  // The row only leaves the list once the restore has actually been written.
  const restore = async (entry: TrashEntry) => {
    try {
      await (workspaceId ? restoreCloud(entry) : restoreLocal(entry));
      setError(null);
      setEntries((prev) => prev && prev.filter((e) => e.id !== entry.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore that item.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold">Trash</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Nothing in this workspace is deleted for good. As a workspace admin you can restore anything here.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter by type" className="flex gap-1">
          {filters.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <label className="relative">
          <span className="sr-only">Search the trash</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the trash"
            className="w-56 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      {entries === null ? (
        <p className="mt-6 py-16 text-center text-sm text-neutral-500">Loading trash…</p>
      ) : visible.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <Trash2 className="h-8 w-8 text-neutral-400" />
          {list.length === 0 ? (
            <>
              <h2 className="mt-3 text-base font-medium">Trash is empty</h2>
              <p className="mt-1 text-sm text-neutral-500">Soft-deleted items will appear here.</p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-base font-medium">Nothing found</h2>
              <p className="mt-1 text-sm text-neutral-500">No trashed items match your filter or search.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {visible.map((entry) => {
            const { label, icon: Icon } = kindMeta[entry.kind];
            const name = entry.key ? `${entry.key} ${entry.title}` : entry.title;
            return (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {label} · {entry.projectName} · deleted {relativeTime(entry.deletedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void restore(entry)}
                  aria-label={`Restore ${name}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TrashView() {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <div className="h-full" />;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return <Trash key={workspaceId ?? "local"} workspaceId={workspaceId} />;
}
