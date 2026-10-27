"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenTool, Plus, Search } from "lucide-react";
import { createDesignFile, loadDesignFiles } from "@/lib/design-storage";
import { getProjects } from "@/lib/projects";
import { relativeTime } from "@/lib/relative-time";
import { useIsClient } from "@/lib/use-is-client";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const projectName = (id: string) => getProjects().find((p) => p.id === id)?.name ?? id;

function Hub() {
  const router = useRouter();
  const [files] = useState(loadDesignFiles);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const q = query.trim().toLowerCase();
  const visible = files
    .filter((f) => !f.deleted_at && (!q || `${f.name} ${projectName(f.project_id)}`.toLowerCase().includes(q)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const openDialog = () => {
    setCreating(true);
    dialogRef.current?.showModal();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    const file = createDesignFile(String(f.get("project")), name);
    router.push(`/projects/${file.project_id}/designs/${file.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Design</h1>
        <button
          type="button"
          onClick={openDialog}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New design file
        </button>
      </div>

      <label className="relative mt-5 block max-w-xs">
        <span className="sr-only">Search design files</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search design files"
          className={`${fieldClass} pl-8`}
        />
      </label>

      {visible.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <PenTool className="h-8 w-8 text-neutral-400" />
          <h2 className="mt-3 text-base font-medium">{files.some((f) => !f.deleted_at) ? "Nothing found" : "No design files yet"}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {files.some((f) => !f.deleted_at) ? "No design files match your search." : "Create one with New design file."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Last edited by</th>
                <th className="px-4 py-2">Edited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((file) => (
                <tr key={file.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/projects/${file.project_id}/designs/${file.id}`}
                      className="flex items-center gap-2 font-medium text-neutral-900 hover:text-indigo-600"
                    >
                      <PenTool className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      {file.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{projectName(file.project_id)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{file.updated_by}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{relativeTime(file.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setCreating(false)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label="New design file"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {creating && (
          <form onSubmit={submit} className="space-y-4 p-5">
            <h2 className="text-base font-semibold">New design file</h2>
            <div>
              <label htmlFor="df-name" className="mb-1 block text-xs font-medium text-neutral-600">
                Name
              </label>
              <input id="df-name" name="name" required autoFocus maxLength={120} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="df-project" className="mb-1 block text-xs font-medium text-neutral-600">
                Project
              </label>
              <select id="df-project" name="project" className={fieldClass}>
                {getProjects().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create design file
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}

export default function DesignHub() {
  const mounted = useIsClient();
  return mounted ? <Hub /> : <div className="h-full" />;
}
