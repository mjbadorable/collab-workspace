"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Download, Rocket } from "lucide-react";
import { buildReleaseMarkdown, createRelease, getReleases, type ProjectRelease } from "@/lib/releases";
import { downloadFile } from "@/lib/project-report";
import type { ProjectRecord } from "@/lib/projects";
import { localDateIso } from "@/lib/checklist";
import { workItemKey, type StoredWorkItem } from "@/lib/work-items-storage";
import { fireConfetti } from "@/components/confetti-burst";
import WorkItemsSource from "./work-items-source";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

function ReleaseCard({ project, release, items }: { project: ProjectRecord; release: ProjectRelease; items: StoredWorkItem[] }) {
  const [copied, setCopied] = useState(false);
  const markdown = () => buildReleaseMarkdown(project, release, items);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: Download .md still works
    }
  };

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-600 px-2.5 py-0.5 font-mono text-xs font-semibold text-white">{release.version}</span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{release.title}</h3>
        <time dateTime={release.publishedAt} className="text-xs text-neutral-500">
          {release.publishedAt}
        </time>
      </div>
      {release.summary && <p className="mt-2 text-sm text-neutral-500">{release.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">
          {release.ticketKeys.length} {release.ticketKeys.length === 1 ? "ticket" : "tickets"}
        </span>
        <button type="button" onClick={copy} className="ml-auto flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied!" : "Copy Release Notes"}
        </button>
        <button
          type="button"
          onClick={() => downloadFile(`${project.id}-${release.version}.md`, markdown(), "text/markdown;charset=utf-8")}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Download .md
        </button>
      </div>
    </li>
  );
}

function CutReleaseForm({
  project,
  releases,
  items,
  onCreate,
  onClose,
}: {
  project: ProjectRecord;
  releases: ProjectRelease[];
  items: StoredWorkItem[];
  onCreate: (input: { version: string; title: string; summary: string; ticketKeys: string[] }) => void;
  onClose: () => void;
}) {
  const done = items.filter((i) => !i.deleted_at && i.status === "done").sort((a, b) => a.seq - b.seq);
  const keyOf = (i: StoredWorkItem) => workItemKey(project.id, i.seq);
  const released = new Set(releases.flatMap((r) => r.ticketKeys));

  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  // Completed work that has not shipped in an earlier release starts out ticked.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(done.map(keyOf).filter((k) => !released.has(k))));
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const ticketKeys = done.map(keyOf).filter((k) => selected.has(k));
  const preview = buildReleaseMarkdown(
    project,
    { version: version.trim() || "vX.Y.Z", title: title.trim() || "Untitled release", summary: summary.trim(), publishedAt: localDateIso(), ticketKeys },
    items
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = version.trim();
    if (!tag) return setError("Enter a version tag, like v2.1.0.");
    if (releases.some((r) => r.version.toLowerCase() === tag.toLowerCase())) return setError(`${tag} has already been released.`);
    if (!title.trim()) return setError("Give the release a title.");
    if (ticketKeys.length === 0) return setError("Choose at least one completed work item.");
    onCreate({ version: tag, title, summary, ticketKeys });
    onClose();
  };

  return (
    <form onSubmit={submit} className="max-h-[88vh] space-y-4 overflow-y-auto p-5">
      <h2 className="text-base font-semibold">🚀 Cut Release</h2>
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <div>
          <label htmlFor="rl-version" className="mb-1 block text-xs font-medium text-neutral-600">Version tag</label>
          <input id="rl-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v2.1.0" maxLength={30} autoFocus className={`${fieldClass} font-mono`} />
        </div>
        <div>
          <label htmlFor="rl-title" className="mb-1 block text-xs font-medium text-neutral-600">Release title</label>
          <input id="rl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor="rl-summary" className="mb-1 block text-xs font-medium text-neutral-600">Summary <span className="font-normal text-neutral-400">(optional)</span></label>
        <textarea id="rl-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={`${fieldClass} resize-none`} />
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-neutral-600">Completed work items ({ticketKeys.length} selected)</legend>
        {done.length === 0 ? (
          <p className="text-sm text-neutral-500">No work items are done yet.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
            {done.map((i) => {
              const key = keyOf(i);
              return (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="h-4 w-4 accent-red-600" />
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{key}</span>
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    {released.has(key) && <span className="shrink-0 text-[11px] text-neutral-400">already released</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div>
        <p className="mb-1 text-xs font-medium text-neutral-600">Changelog preview</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed">{preview}</pre>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">Cancel</button>
        <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Cut release</button>
      </div>
    </form>
  );
}

function Releases({ project, items }: { project: ProjectRecord; items: StoredWorkItem[] | null }) {
  const [releases, setReleases] = useState<ProjectRelease[]>(() => getReleases(project.id));
  const [cutting, setCutting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (cutting && !dialog.open) dialog.showModal();
    if (!cutting && dialog.open) dialog.close();
  }, [cutting]);

  const sorted = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.version.localeCompare(a.version, undefined, { numeric: true }));

  return (
    <section aria-labelledby="ov-releases">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ov-releases" className="text-sm font-semibold text-neutral-700">
          Releases &amp; Changelog
        </h2>
        <button type="button" onClick={() => setCutting(true)} disabled={items === null} className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
          <Rocket className="h-4 w-4" aria-hidden /> 🚀 Cut Release
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-500">
          No releases yet. Cut one when a set of work items has shipped.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {sorted.map((r) => (
            <ReleaseCard key={r.id} project={project} release={r} items={items ?? []} />
          ))}
        </ul>
      )}
      <dialog
        ref={dialogRef}
        onClose={() => setCutting(false)}
        onClick={(e) => e.target === e.currentTarget && setCutting(false)}
        aria-label="Cut release"
        className="m-auto w-full max-w-xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {/* Mounting the form only while open starts every release from a clean draft. */}
        {cutting && items && (
          <CutReleaseForm
            project={project}
            releases={releases}
            items={items}
            onCreate={(input) => {
              setReleases(createRelease(project.id, input));
              fireConfetti();
            }}
            onClose={() => setCutting(false)}
          />
        )}
      </dialog>
    </section>
  );
}

// The project's release timeline and the dialog that cuts a new one.
export default function ReleasesPanel({ project }: { project: ProjectRecord }) {
  return (
    // Remounted per project so the timeline never shows another project's releases.
    <WorkItemsSource key={project.id} projectId={project.id} fallback={<div className="h-24" />}>
      {({ items }) => <Releases project={project} items={items} />}
    </WorkItemsSource>
  );
}
