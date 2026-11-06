"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Copy, File, FileCode2, Folder, FolderOpen, GitCompare, Laptop, RefreshCw } from "lucide-react";
import { useProjects } from "@/lib/projects-context";
import { ProjectNotFound } from "./project-overview";

type Entry = { name: string; path: string; type: "dir" | "file"; size: number };

type ListResponse =
  | { isLocal: false; files: [] }
  | { ok: false; error: string }
  | { ok: true; isLocal: true; type: "dir"; path: string; files: Entry[]; truncated: boolean };

type FileResponse =
  | { isLocal: false; files: [] }
  | { ok: false; error: string }
  | { ok: true; isLocal: true; type: "file"; path: string; size: number; content: string; lines: number }
  | { ok: true; isLocal: true; type: "file"; path: string; size: number; content: null; reason: "binary" | "too-large" };

type OpenFile = { path: string; size: number; lines: number; content: string } | { path: string; size: number; note: string };

type ChangeStatus = "modified" | "added" | "deleted" | "untracked";
type ChangedFile = { path: string; status: ChangeStatus; insertions: number; deletions: number };

type ChangesResponse =
  | { isLocal: false; files: [] }
  | { ok: false; error: string }
  | { isLocal: true; clean: boolean; files: ChangedFile[] };

type DiffResponse =
  | { isLocal: false; files: [] }
  | { ok: false; error: string }
  | { isLocal: true; file: string; status: ChangeStatus; diff: string; truncated: boolean; insertions: number; deletions: number };

type OpenDiff = { path: string; diff: string; truncated: boolean; insertions: number; deletions: number };

const PILL: Record<ChangeStatus, { letter: string; label: string; className: string }> = {
  modified: { letter: "M", label: "Modified", className: "bg-amber-100 text-amber-800" },
  added: { letter: "A", label: "Added", className: "bg-emerald-100 text-emerald-800" },
  deleted: { letter: "D", label: "Deleted", className: "bg-rose-100 text-rose-800" },
  untracked: { letter: "?", label: "Untracked", className: "bg-slate-200 text-slate-700" },
};

const CODE_EXT = /\.(tsx?|jsx?|mjs|cjs|json|css|sql|md|html)$/i;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fetchSource<T>(projectId: string, path: string): Promise<T> {
  const res = await fetch(`/api/local-source?project=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`);
  return (await res.json()) as T;
}

// Lines before the first hunk are git's file header; inside hunks "+" and "-" are real additions and removals.
function lineClass(line: string, inHunk: boolean): string {
  if (line.startsWith("@@")) return "bg-neutral-100 font-semibold text-neutral-600";
  if (!inHunk) return "text-neutral-400";
  if (line.startsWith("+")) return "border-l-2 border-emerald-500 bg-emerald-50 text-emerald-900";
  if (line.startsWith("-")) return "border-l-2 border-rose-500 bg-rose-50 text-rose-900";
  return "border-l-2 border-transparent";
}

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  const hunkFlags = lines.reduce<boolean[]>((flags, line, i) => {
    const prev = i > 0 && flags[i - 1];
    flags.push(line.startsWith("@@") ? true : line.startsWith("diff --git") ? false : prev);
    return flags;
  }, []);
  const rows = lines.map((line, i) => (
    <div key={i} className={`whitespace-pre px-4 ${lineClass(line, hunkFlags[i])}`}>
      {line || " "}
    </div>
  ));
  return <div className="min-h-0 flex-1 overflow-auto bg-white py-2 font-mono text-xs leading-5">{rows}</div>;
}

const tabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors ${
    active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600 hover:text-neutral-900"
  }`;

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Laptop className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
    </div>
  );
}

export default function SourceCodeInspector({ projectId }: { projectId: string }) {
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const [dirs, setDirs] = useState<Record<string, Entry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"loading" | "cloud" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [file, setFile] = useState<OpenFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [copied, setCopied] = useState(false);

  // ?tab=changes (the Deployment Gate's deep link) opens on the Changes tab.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"files" | "changes">(() => (searchParams.get("tab") === "changes" ? "changes" : "files"));
  const [changes, setChanges] = useState<ChangedFile[] | null>(null);
  const [changesError, setChangesError] = useState("");
  const [reloadChanges, setReloadChanges] = useState(0);
  const [diff, setDiff] = useState<OpenDiff | null>(null);
  const [diffError, setDiffError] = useState("");
  const [copiedDiff, setCopiedDiff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/local-git-diff?project=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<ChangesResponse>)
      .then((data) => {
        if (cancelled) return;
        if ("clean" in data) {
          setChanges(data.files);
          setChangesError("");
        } else if ("ok" in data) {
          setChangesError(data.error);
        }
      })
      .catch(() => {
        if (!cancelled) setChangesError("Could not read git changes");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadChanges]);

  useEffect(() => {
    let cancelled = false;
    fetchSource<ListResponse>(projectId, "")
      .then((data) => {
        if (cancelled) return;
        if ("isLocal" in data && data.isLocal === false) return setStatus("cloud");
        if ("ok" in data && data.ok) {
          setDirs({ "": data.files });
          return setStatus("ready");
        }
        setError("error" in data ? data.error : "Unexpected response");
        setStatus("error");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not reach the local dev server");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const toggleDir = async (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
    if (dirs[path]) return;
    try {
      const data = await fetchSource<ListResponse>(projectId, path);
      if ("ok" in data && data.ok) setDirs((d) => ({ ...d, [path]: data.files }));
    } catch {
      // The folder simply stays empty; the next toggle retries.
    }
  };

  const openFile = async (entry: Entry) => {
    setFileError("");
    setCopied(false);
    try {
      const data = await fetchSource<FileResponse>(projectId, entry.path);
      if ("ok" in data && data.ok) {
        if (data.content === null) {
          setFile({
            path: data.path,
            size: data.size,
            note: data.reason === "binary" ? "Binary file: no preview." : "File is larger than 512 KB: no preview.",
          });
        } else {
          setFile({ path: data.path, size: data.size, lines: data.lines, content: data.content });
        }
      } else {
        setFile(null);
        setFileError("error" in data ? data.error : "Could not read file");
      }
    } catch {
      setFile(null);
      setFileError("Could not read file");
    }
  };

  const openDiff = async (change: ChangedFile) => {
    setDiffError("");
    setCopiedDiff(false);
    try {
      const res = await fetch(`/api/local-git-diff?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(change.path)}`, { cache: "no-store" });
      const data = (await res.json()) as DiffResponse;
      if ("diff" in data) {
        setDiff({ path: data.file, diff: data.diff, truncated: data.truncated, insertions: data.insertions, deletions: data.deletions });
      } else {
        setDiff(null);
        setDiffError("error" in data ? data.error : "Could not read diff");
      }
    } catch {
      setDiff(null);
      setDiffError("Could not read diff");
    }
  };

  const copyDiff = async () => {
    if (!diff) return;
    try {
      await navigator.clipboard.writeText(diff.diff);
      setCopiedDiff(true);
      setTimeout(() => setCopiedDiff(false), 1500);
    } catch {
      setDiffError("Clipboard is not available");
    }
  };

  const copy = async () => {
    if (!file || !("content" in file)) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFileError("Clipboard is not available");
    }
  };

  if (!project) return <ProjectNotFound />;

  if (status === "cloud") {
    return (
      <Message
        title="Available in Local Dev Mode"
        body="The Source Code Inspector reads files from the folder on your machine, so it only works when this app runs on localhost."
      />
    );
  }
  if (status === "error") return <Message title="Source not available" body={error} />;

  const renderEntries = (path: string, depth: number) =>
    (dirs[path] ?? []).map((entry) => {
      if (entry.type === "dir") {
        const open = expanded.has(entry.path);
        const Chevron = open ? ChevronDown : ChevronRight;
        const FolderIcon = open ? FolderOpen : Folder;
        return (
          <li key={entry.path}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleDir(entry.path)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm hover:bg-neutral-100"
            >
              <Chevron className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
              <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="truncate">{entry.name}</span>
            </button>
            {open && <ul>{renderEntries(entry.path, depth + 1)}</ul>}
          </li>
        );
      }
      const FileIcon = CODE_EXT.test(entry.name) ? FileCode2 : File;
      const selected = file?.path === entry.path;
      return (
        <li key={entry.path}>
          <button
            type="button"
            onClick={() => openFile(entry)}
            style={{ paddingLeft: `${depth * 12 + 26}px` }}
            className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm ${
              selected ? "bg-neutral-200 font-medium" : "hover:bg-neutral-100"
            }`}
          >
            <FileIcon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            <span className="truncate">{entry.name}</span>
          </button>
        </li>
      );
    });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-neutral-200 px-6 py-3">
        <h1 className="text-base font-semibold">Source Code</h1>
        <p className="text-xs text-neutral-500">Read-only view of {project.name} on this machine. Secrets and build folders are hidden.</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Files" className="max-h-64 w-full shrink-0 overflow-y-auto border-b border-neutral-200 p-2 md:max-h-none md:w-72 md:border-b-0 md:border-r">
          <div role="tablist" aria-label="Source view" className="mb-2 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
            <button type="button" role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")} className={tabClass(tab === "files")}>
              <span aria-hidden>📁</span> All Files
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "changes"}
              onClick={() => {
                setTab("changes");
                setReloadChanges((n) => n + 1);
              }}
              className={tabClass(tab === "changes")}
            >
              <span aria-hidden>🔀</span> Changes{changes ? ` (${changes.length})` : ""}
            </button>
          </div>
          {tab === "files" ? (
            status === "loading" ? (
              <p className="p-2 text-sm text-neutral-500">Loading files…</p>
            ) : (
              <ul>{renderEntries("", 0)}</ul>
            )
          ) : changesError ? (
            <p className="p-2 text-sm text-neutral-500">{changesError}</p>
          ) : changes === null ? (
            <p className="p-2 text-sm text-neutral-500">Reading git status…</p>
          ) : changes.length === 0 ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-800">
              Working tree is clean · No uncommitted changes
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setReloadChanges((n) => n + 1)}
                className="mb-1 flex items-center gap-1 px-2 text-[11px] text-neutral-500 hover:text-neutral-900"
              >
                <RefreshCw className="h-3 w-3" aria-hidden /> Refresh
              </button>
              <ul>
                {changes.map((c) => {
                  const pill = PILL[c.status];
                  const selected = diff?.path === c.path;
                  return (
                    <li key={c.path}>
                      <button
                        type="button"
                        onClick={() => openDiff(c)}
                        title={c.path}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${selected ? "bg-neutral-200 font-medium" : "hover:bg-neutral-100"}`}
                      >
                        <span title={pill.label} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${pill.className}`}>
                          {pill.letter}
                          <span className="sr-only">{pill.label}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.path.split("/").pop()}</span>
                        <span className="shrink-0 font-mono text-[11px]">
                          {c.insertions > 0 && <span className="text-emerald-600">+{c.insertions}</span>}
                          {c.insertions > 0 && c.deletions > 0 && " "}
                          {c.deletions > 0 && <span className="text-rose-600">-{c.deletions}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {tab === "changes" ? (
            diff ? (
              <>
                <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-sm" title={diff.path}>
                    {diff.path}
                  </p>
                  <span className="shrink-0 font-mono text-xs">
                    <span className="text-emerald-600">+{diff.insertions}</span> <span className="text-rose-600">-{diff.deletions}</span>
                  </span>
                  <button
                    type="button"
                    onClick={copyDiff}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
                  >
                    {copiedDiff ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                    {copiedDiff ? "Copied" : "Copy Diff"}
                  </button>
                </div>
                {diff.truncated && <p className="border-b border-amber-200 bg-amber-50 px-4 py-1 text-xs text-amber-800">Diff truncated at 512 KB.</p>}
                {diff.diff ? <DiffView diff={diff.diff} /> : <p className="p-6 text-sm text-neutral-500">No textual changes to show (mode change or empty file).</p>}
              </>
            ) : (
              <p className="flex items-center gap-2 p-6 text-sm text-neutral-500">
                <GitCompare className="h-4 w-4" aria-hidden /> {diffError || "Select a changed file to view its diff."}
              </p>
            )
          ) : file ? (
            <>
              <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2">
                <p className="min-w-0 flex-1 truncate font-mono text-sm" title={file.path}>
                  {file.path}
                </p>
                <span className="shrink-0 text-xs text-neutral-500">
                  {formatSize(file.size)}
                  {"lines" in file && ` · ${file.lines} lines`}
                </span>
                {"content" in file && (
                  <button
                    type="button"
                    onClick={copy}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                    {copied ? "Copied" : "Copy Code"}
                  </button>
                )}
              </div>
              {"content" in file ? (
                <div className="min-h-0 flex-1 overflow-auto bg-neutral-50 py-2 font-mono text-xs leading-5">
                  <table className="border-collapse">
                    <tbody>
                      {file.content.split(/\r\n|\r|\n/).map((line, i) => (
                        <tr key={i}>
                          <td className="select-none pl-4 pr-3 text-right align-top text-neutral-400">{i + 1}</td>
                          <td className="whitespace-pre pr-6">{line || " "}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-sm text-neutral-500">{file.note}</p>
              )}
            </>
          ) : (
            <p className="p-6 text-sm text-neutral-500">{fileError || "Select a file to view its source."}</p>
          )}
        </section>
      </div>
    </div>
  );
}
