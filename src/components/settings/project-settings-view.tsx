"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bug, CheckSquare, Plus, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import LiveWorkItems from "@/components/home/live-work-items";
import ProjectAvatar from "@/components/project-avatar";
import { priorityOptions, statusOptions } from "@/components/work-items/work-items-view";
import { useAuth } from "@/lib/auth-context";
import { fetchMembers, type Member } from "@/lib/members";
import { initials, mockUser } from "@/lib/mock-data";
import type { ProjectRecord } from "@/lib/projects";
import { useWorkspacePermissions } from "@/lib/use-permissions";
import { useProjects } from "@/lib/projects-context";
import type { StoredWorkItem } from "@/lib/work-items-storage";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkspaces } from "@/lib/workspace-context";

type Tab = "general" | "members" | "states" | "types" | "qa" | "labels";

const tabs: { value: Tab; label: string }[] = [
  { value: "general", label: "General" },
  { value: "members", label: "Members" },
  { value: "states", label: "States" },
  { value: "types", label: "Work item types" },
  { value: "qa", label: "QA results" },
  { value: "labels", label: "Labels" },
];

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

const isHttpUrl = (value: string) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function General({ project }: { project: ProjectRecord }) {
  const router = useRouter();
  const { updateProject, deleteProject } = useProjects();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { user } = useAuth();
  const { current } = useWorkspaces();
  const { isAdmin, loading: permsLoading } = useWorkspacePermissions(user && current ? current.id : null);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const github_url = String(f.get("github") ?? "").trim();
    const live_url = String(f.get("live") ?? "").trim();
    setSaved(false);
    if (!name) return setError("The project needs a name.");
    if (!isHttpUrl(github_url) || !isHttpUrl(live_url)) return setError("URLs must start with http:// or https://.");
    setError(null);
    updateProject(project.id, {
      name,
      description: String(f.get("description") ?? "").trim(),
      github_url,
      live_url,
      frontend_stack: String(f.get("frontend") ?? "").trim(),
      backend_stack: String(f.get("backend") ?? "").trim(),
      functions: String(f.get("functions") ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
    });
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">General</h2>
      <form onSubmit={save} className="grid max-w-lg gap-4">
        <div>
          <label htmlFor="ps-name" className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
          <input id="ps-name" name="name" required maxLength={80} defaultValue={project.name} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-id" className="mb-1 block text-xs font-medium text-neutral-600">Identifier</label>
          <input id="ps-id" value={project.identifier} readOnly className={`${fieldClass} bg-neutral-50 font-mono`} />
          <p className="mt-1 text-xs text-neutral-500">Fixed after creation: it keys work items and cloud sync.</p>
        </div>
        <div>
          <label htmlFor="ps-desc" className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
          <textarea id="ps-desc" name="description" rows={3} defaultValue={project.description} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-github" className="mb-1 block text-xs font-medium text-neutral-600">GitHub repository URL</label>
          <input id="ps-github" name="github" type="url" defaultValue={project.github_url} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-live" className="mb-1 block text-xs font-medium text-neutral-600">Production live URL</label>
          <input id="ps-live" name="live" type="url" defaultValue={project.live_url} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-functions" className="mb-1 block text-xs font-medium text-neutral-600">Core functions (one per line)</label>
          <textarea id="ps-functions" name="functions" rows={4} defaultValue={project.functions.join("\n")} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-frontend" className="mb-1 block text-xs font-medium text-neutral-600">Frontend stack</label>
          <input id="ps-frontend" name="frontend" defaultValue={project.frontend_stack} placeholder="React 19, Vite 8, Tailwind CSS v4" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="ps-backend" className="mb-1 block text-xs font-medium text-neutral-600">Backend / storage stack</label>
          <input id="ps-backend" name="backend" defaultValue={project.backend_stack} placeholder="IndexedDB (Dexie.js v4), Service Worker" className={fieldClass} />
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{error}</p>}
        {saved && <p role="status" className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-800">Changes saved.</p>}
        <div>
          <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            Save changes
          </button>
        </div>
      </form>

      <div className="max-w-lg rounded-lg border border-red-200 p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Removes the project from your workspace. Its work items stay stored and can be recovered by re-creating a project with the same identifier.
        </p>
        {!isAdmin ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              aria-describedby="ps-delete-gate"
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 opacity-50"
            >
              Delete project
            </button>
            <span
              id="ps-delete-gate"
              className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
            >
              {permsLoading ? "Checking your role…" : "Admin role required to delete projects"}
            </span>
          </div>
        ) : confirming ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                deleteProject(project.id);
                router.push("/projects");
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Yes, delete {project.name}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            Delete project
          </button>
        )}
      </div>
    </div>
  );
}

function Members({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMembers(workspaceId).then(
      (rows) => {
        if (!cancelled) setMembers(rows);
      },
      (e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load members.");
        setMembers([]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (error) return <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!members) return <p className="py-8 text-sm text-neutral-500">Loading members…</p>;
  return (
    <Rows
      rows={members.map((m) => ({
        key: m.user_id,
        name: m.email + (m.user_id === user?.id ? " (you)" : ""),
        role: m.role === "admin" ? "Admin" : "Member",
      }))}
    />
  );
}

function Rows({ rows }: { rows: { key: string; name: string; role: string }[] }) {
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
            {initials(r.name.split("@")[0].replace(/[._-]+/g, " ")) || "?"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{r.role}</span>
        </li>
      ))}
    </ul>
  );
}

function MembersTab() {
  const { user } = useAuth();
  const { current } = useWorkspaces();
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Members</h2>
      <p className="text-sm text-neutral-500">
        Project teammates are your workspace members. Invite more from{" "}
        <Link href="/settings" className="text-red-600 hover:underline">workspace settings</Link>.
      </p>
      {user && current ? (
        <Members key={current.id} workspaceId={current.id} />
      ) : (
        <Rows rows={[{ key: "me", name: mockUser.email, role: "Admin" }]} />
      )}
    </div>
  );
}

const itemTypes: { label: string; icon: LucideIcon; isDefault?: boolean }[] = [
  { label: "Task", icon: CheckSquare, isDefault: true },
  { label: "Bug", icon: Bug },
  { label: "Feature / Improvement", icon: Sparkles },
  { label: "Performance / Story", icon: TrendingUp },
  { label: "Documentation", icon: BookOpen },
];

function WorkItemTypes({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Work item types</h2>
        <button
          type="button"
          disabled
          title="Custom types are coming in a later milestone"
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add type
        </button>
      </div>
      <p className="max-w-2xl text-sm text-neutral-500">
        Every work item has one type, such as Task, Bug or Documentation. Types are shown as icons and can be used to
        filter and group work items.
      </p>
      <LiveWorkItems projectId={projectId} fallback={<div className="h-64" />}>
        {(items) => (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {itemTypes.map(({ label, icon: Icon, isDefault }) => (
              <li key={label} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {label}
                    {isDefault && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">No QA template</p>
                </div>
                {/* Work items have no type field yet, so every item counts as the default Task. */}
                <span className="text-sm tabular-nums text-neutral-500">{items ? (isDefault ? items.length : 0) : "–"}</span>
              </li>
            ))}
          </ul>
        )}
      </LiveWorkItems>
    </div>
  );
}

function CountList<T extends { value: string; label: string }>({
  title,
  note,
  options,
  field,
  projectId,
}: {
  title: string;
  note: string;
  options: T[];
  field: keyof Pick<StoredWorkItem, "status" | "priority">;
  projectId: string;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-2xl text-sm text-neutral-500">{note}</p>
      <LiveWorkItems projectId={projectId} fallback={<div className="h-40" />}>
        {(items) => (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {options.map((o) => (
              <li key={o.value} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="tabular-nums text-neutral-500">{items ? items.filter((i) => i[field] === o.value).length : "–"}</span>
              </li>
            ))}
          </ul>
        )}
      </LiveWorkItems>
    </div>
  );
}

export default function ProjectSettingsView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const [tab, setTab] = useState<Tab>("types");
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Project not found</h1>
        <p className="mt-1 text-sm text-neutral-500">It may have been deleted, or it lives in another workspace.</p>
        <Link href="/projects" className="mt-4 inline-block text-sm text-red-600 hover:underline">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
        <span aria-hidden>›</span>
        <Link href={`/projects/${project.id}/work-items`} className="flex items-center gap-1.5 hover:text-neutral-900">
          <ProjectAvatar project={project} className="h-5 w-5 text-[11px]" />
          {project.name}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-neutral-900">Settings</span>
      </nav>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Project settings" className="shrink-0 md:w-48">
          <p className="px-2.5 pb-2 font-mono text-xs font-semibold uppercase tracking-wide text-neutral-400">{project.identifier}</p>
          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-current={tab === t.value ? "page" : undefined}
                onClick={() => setTab(t.value)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm ${
                  tab === t.value ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {/* Remount per project so form defaults never show another project's values. */}
          {tab === "general" && <General key={project.id} project={project} />}
          {tab === "members" && <MembersTab />}
          {tab === "states" && (
            <CountList
              title="States"
              note="The workflow statuses a work item moves through. Counts are live items in each state."
              options={statusOptions}
              field="status"
              projectId={project.id}
            />
          )}
          {tab === "types" && <WorkItemTypes projectId={project.id} />}
          {tab === "qa" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">QA results</h2>
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center">
                <p className="text-sm font-medium">No QA runs yet</p>
                <p className="mt-1 text-sm text-neutral-500">Test runs and QA templates for this project will appear here.</p>
              </div>
            </div>
          )}
          {tab === "labels" && (
            <CountList
              title="Labels"
              note="Priority labels applied to work items. Counts are live items with each label."
              options={priorityOptions}
              field="priority"
              projectId={project.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
