"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, File, FileCode2, Folder, FolderOpen, Laptop } from "lucide-react";
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
          {status === "loading" ? <p className="p-2 text-sm text-neutral-500">Loading files…</p> : <ul>{renderEntries("", 0)}</ul>}
        </nav>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {file ? (
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
