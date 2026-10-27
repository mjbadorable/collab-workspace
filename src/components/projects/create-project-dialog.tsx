"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GitFork, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ensureCloudProject } from "@/lib/cloud-projects";
import { normalizeIdentifier, suggestIdentifier } from "@/lib/identifier";
import { useProjects } from "@/lib/projects-context";
import { useStorageTarget } from "@/lib/storage-target";
import { addWorkItem, insertCloudWorkItem, saveWorkItems, type NewWorkItemInput, type StoredWorkItem } from "@/lib/work-items-storage";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

const iconChoices = ["🙂", "🚀", "📚", "🛠️", "🎮", "📊", "🧪", "🌐"];

type Draft = { title: string; priority: NewWorkItemInput["priority"] };

type Breakdown =
  | { ok: true; project: { name: string; identifier: string; description: string; live_url: string; github_url: string; icon: string; functions: string[]; frontend_stack: string; backend_stack: string }; workItems: Draft[] }
  | { ok: false; error: string };

const isHttpUrl = (value: string) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function CreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const target = useStorageTarget();
  const { projects, createProject } = useProjects();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [identifierEdited, setIdentifierEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // GitHub import
  const [importUrl, setImportUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [autofilled, setAutofilled] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [stack, setStack] = useState({ functions: [] as string[], frontend_stack: "", backend_stack: "" });
  const latest = useRef(0); // ignores a slow response once a newer analysis has started

  const shownIdentifier = identifierEdited ? identifier : suggestIdentifier(name);
  const leadLabel = user?.email ?? "You";

  const analyze = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return setImportError("Paste a GitHub repository URL first.");
    const run = ++latest.current;
    setAnalyzing(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/github-breakdown?url=${encodeURIComponent(trimmed)}`);
      const data: Breakdown = await res.json();
      if (run !== latest.current) return;
      if (!data.ok) {
        setImportError(data.error);
        return;
      }
      const p = data.project;
      setName(p.name);
      setIdentifier(normalizeIdentifier(p.identifier));
      setIdentifierEdited(true);
      setDescription(p.description);
      setLiveUrl(p.live_url);
      setGithubUrl(p.github_url);
      setIcon(p.icon);
      setDrafts(data.workItems);
      setStack({ functions: p.functions, frontend_stack: p.frontend_stack, backend_stack: p.backend_stack });
      setAutofilled(true);
      setError(null);
    } catch {
      if (run === latest.current) setImportError("Could not analyze that repository. Try again, or fill the form manually.");
    } finally {
      if (run === latest.current) setAnalyzing(false);
    }
  };

  const onImportPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;
    setImportUrl(pasted);
    e.preventDefault();
    void analyze(pasted);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = normalizeIdentifier(shownIdentifier);
    const lead = String(new FormData(e.currentTarget).get("lead") ?? "");
    if (!name.trim()) return setError("Give the project a name.");
    if (!id) return setError("Add an identifier, e.g. SP.");
    if (projects.some((p) => p.identifier === id)) return setError(`The identifier ${id} is already used by another project.`);
    if (!isHttpUrl(githubUrl.trim()) || !isHttpUrl(liveUrl.trim())) {
      return setError("Repository and live URLs must start with http:// or https://.");
    }

    setSaving(true);
    const project = createProject({
      name,
      identifier: id,
      description,
      icon,
      is_public: isPublic,
      github_url: githubUrl,
      live_url: liveUrl,
      lead: lead || null,
      ...stack,
    });

    // Pre-populate the Kanban board with the tasks discovered in the README.
    if (drafts.length > 0) {
      const inputs: NewWorkItemInput[] = drafts.map((d) => ({ title: d.title, description: "", status: "backlog", priority: d.priority }));
      const seeded = inputs.reduce<StoredWorkItem[]>((items, input) => addWorkItem(items, project.id, input), []);
      saveWorkItems(project.id, seeded);
      if (target.mode === "cloud") {
        try {
          const uuid = await ensureCloudProject(target.workspaceId, project.id);
          for (const input of inputs) await insertCloudWorkItem(uuid, input);
        } catch {
          // The project and its local items exist; the board's own error banner reports cloud problems.
        }
      }
    }

    onClose();
    router.push(`/projects/${project.id}/work-items`);
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <h2 className="text-base font-semibold">Create project</h2>

      <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
          <Sparkles className="h-4 w-4" aria-hidden /> Plug &amp; Play: Import from GitHub
        </p>
        <div className="mt-2 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <GitFork className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <label htmlFor="cp-import" className="sr-only">
              GitHub repository URL
            </label>
            <input
              id="cp-import"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onPaste={onImportPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void analyze(importUrl);
                }
              }}
              placeholder="https://github.com/owner/repo"
              className={`${fieldClass} pl-8`}
            />
          </div>
          <button
            type="button"
            onClick={() => void analyze(importUrl)}
            disabled={analyzing}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {analyzing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {analyzing ? "Analyzing…" : "Analyze & Autofill"}
          </button>
        </div>
        {importError && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {importError}
          </p>
        )}
        {autofilled && !importError && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs" role="status">
            <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 font-medium text-red-700">Autofilled from GitHub</span>
            {(stack.frontend_stack || stack.backend_stack) && (
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-700">✓ Detected tech stack</span>
            )}
            {drafts.length > 0 && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                ✓ Discovered {drafts.length} {drafts.length === 1 ? "task" : "tasks"} from README
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickingIcon((v) => !v)}
            aria-label="Choose project icon"
            aria-expanded={pickingIcon}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 text-lg hover:bg-neutral-100"
          >
            {icon ?? (name.trim()[0]?.toUpperCase() || "🙂")}
          </button>
          {pickingIcon && (
            <div className="absolute left-0 top-full z-10 mt-1 grid w-40 grid-cols-4 gap-1 rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg">
              {iconChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    setIcon(choice);
                    setPickingIcon(false);
                  }}
                  className="rounded p-1 text-lg hover:bg-neutral-100"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="cp-name" className="sr-only">
            Project name
          </label>
          <input
            id="cp-name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="cp-id" className="mb-1 block text-xs font-medium text-neutral-600">
          Identifier
        </label>
        <input
          id="cp-id"
          value={shownIdentifier}
          onChange={(e) => {
            setIdentifierEdited(true);
            setIdentifier(normalizeIdentifier(e.target.value));
          }}
          placeholder="SP"
          className={`${fieldClass} font-mono uppercase`}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Work items will be numbered {shownIdentifier || "ID"}-1, {shownIdentifier || "ID"}-2, …
        </p>
      </div>

      <div>
        <label htmlFor="cp-desc" className="mb-1 block text-xs font-medium text-neutral-600">
          Description
        </label>
        <textarea
          id="cp-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this project about? (optional)"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-github" className="mb-1 block text-xs font-medium text-neutral-600">
            Monitored GitHub repository URL
          </label>
          <input
            id="cp-github"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="cp-live" className="mb-1 block text-xs font-medium text-neutral-600">
            Production live URL
          </label>
          <input
            id="cp-live"
            type="url"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="https://app.example.com"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          onClick={() => setIsPublic((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            isPublic ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-200 bg-neutral-100 text-neutral-600"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isPublic ? "bg-red-500" : "bg-neutral-400"}`} aria-hidden />
          {isPublic ? "Public" : "Private"}
        </button>
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
          Project lead
          <select name="lead" defaultValue={leadLabel} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-normal">
            <option value={leadLabel}>{leadLabel}</option>
            <option value="">No lead</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}

// Controlled by ProjectsProvider; the sidebar "+" and the Projects hub both open it. Esc, backdrop click and Cancel close it.
export default function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Create project"
      className="m-auto w-full max-w-lg rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounting the form only while open resets its fields every time. */}
      {open && <CreateForm onClose={onClose} />}
    </dialog>
  );
}
