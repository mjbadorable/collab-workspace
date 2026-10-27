"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, GitFork, Network, Palette, Pencil, RefreshCw, SquareCheckBig, Users } from "lucide-react";
import type { MockProject } from "@/lib/mock-data";
import type { StoredWorkItem } from "@/lib/work-items-storage";

type Links = { repoUrl: string; liveUrl: string };
type Health = { state: "checking" } | { state: "online"; status: number; latencyMs: number } | { state: "offline" };

const DEFAULT_LINKS: Links = {
  repoUrl: "https://github.com/mjbadorable/exam-reviewer-app",
  liveUrl: "https://exam-reviewer.vercel.app",
};

const storageKey = (projectId: string) => `collab-workspace:project-links:${projectId}`;

// Cards render only after the client mounts (LiveWorkItems), so reading storage in a lazy initializer is hydration-safe.
function loadLinks(projectId: string): Links {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? "null");
    if (saved && typeof saved.repoUrl === "string" && typeof saved.liveUrl === "string") return saved;
  } catch {
    // Fall through to the defaults.
  }
  return DEFAULT_LINKS;
}

const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function HealthMonitor({ projectId }: { projectId: string }) {
  const [links, setLinks] = useState<Links>(() => loadLinks(projectId));
  const [health, setHealth] = useState<Health>({ state: "checking" });
  const [nonce, setNonce] = useState(0);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/health-check?url=${encodeURIComponent(links.liveUrl)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { ok: boolean; status: number; latencyMs: number }) =>
        setHealth(d.ok ? { state: "online", status: d.status, latencyMs: d.latencyMs } : { state: "offline" })
      )
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ state: "offline" });
      });
    return () => controller.abort();
  }, [links.liveUrl, nonce]);

  const recheck = () => {
    setHealth({ state: "checking" });
    setNonce((n) => n + 1);
  };

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next: Links = { repoUrl: String(f.get("repo") ?? "").trim(), liveUrl: String(f.get("live") ?? "").trim() };
    if (!isHttpUrl(next.repoUrl) || !isHttpUrl(next.liveUrl)) {
      setFormError("Enter valid http(s) URLs.");
      return;
    }
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies for this session.
    }
    setFormError(null);
    setEditing(false);
    if (next.liveUrl !== links.liveUrl) setHealth({ state: "checking" });
    setLinks(next);
  };

  const dot = health.state === "online" ? "bg-emerald-500" : health.state === "offline" ? "bg-red-500" : "bg-amber-400";
  const label =
    health.state === "online"
      ? `Production Live · ${health.status} OK (Latency ~${health.latencyMs}ms)`
      : health.state === "offline"
        ? "Offline / Unreachable"
        : "Checking…";

  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          {health.state !== "offline" && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
        </span>
        <span role="status" className="min-w-0 flex-1 truncate font-medium text-neutral-700">
          {label}
        </span>
        <button
          type="button"
          onClick={recheck}
          disabled={health.state === "checking"}
          aria-label="Re-check health"
          title="Re-check health"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${health.state === "checking" ? "animate-spin" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-label="Edit links"
          title="Edit links"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <a
          href={links.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100"
        >
          <GitFork className="h-3.5 w-3.5" aria-hidden /> GitHub
        </a>
        <a
          href={links.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Live App
        </a>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
          <label className="block text-xs font-medium text-neutral-600">
            GitHub repository URL
            <input
              name="repo"
              type="url"
              required
              defaultValue={links.repoUrl}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Live production URL
            <input
              name="live"
              type="url"
              required
              defaultValue={links.liveUrl}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </label>
          {formError && (
            <p role="alert" className="text-xs text-red-600">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function progressOf(items: StoredWorkItem[] | null) {
  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.status === "done").length ?? 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

const shortcuts = [
  { label: "Work items", slug: "work-items", icon: SquareCheckBig },
  { label: "Diagrams", slug: "diagrams", icon: Network },
  { label: "Designs", slug: "designs", icon: Palette },
];

export default function ProjectCard({ project, items }: { project: MockProject; items: StoredWorkItem[] | null }) {
  const { total, done, percent } = progressOf(items);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-red-500 to-amber-400 font-mono text-xs font-semibold text-white">
          {project.identifier}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{project.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="rounded-full border border-neutral-200 px-2 py-0.5">Public</span>
            <span className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5">
              <Users className="h-3 w-3" aria-hidden /> 1 member
            </span>
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
              Admin
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            {items ? `${done}/${total} tasks completed` : "Loading…"}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              percent === 100 ? "bg-emerald-500" : "bg-linear-to-r from-red-500 to-amber-400"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <HealthMonitor projectId={project.id} />

      <div className="mt-4 flex flex-wrap gap-2">
        {shortcuts.map(({ label, slug, icon: Icon }) => (
          <Link
            key={slug}
            href={`/projects/${project.id}/${slug}`}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
