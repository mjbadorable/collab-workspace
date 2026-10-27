"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useProjects } from "@/lib/projects-context";
import { normalizeIdentifier, suggestIdentifier } from "@/lib/projects";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

const iconChoices = ["🙂", "🚀", "📚", "🛠️", "🎮", "📊", "🧪", "🌐"];

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
  const { projects, createProject } = useProjects();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [identifierEdited, setIdentifierEdited] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shownIdentifier = identifierEdited ? identifier : suggestIdentifier(name);
  const leadLabel = user?.email ?? "You";

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const id = normalizeIdentifier(shownIdentifier);
    const github = String(f.get("github") ?? "").trim();
    const live = String(f.get("live") ?? "").trim();
    if (!name.trim()) return setError("Give the project a name.");
    if (!id) return setError("Add an identifier, e.g. SP.");
    if (projects.some((p) => p.identifier === id)) return setError(`The identifier ${id} is already used by another project.`);
    if (!isHttpUrl(github) || !isHttpUrl(live)) return setError("Repository and live URLs must start with http:// or https://.");

    const lead = String(f.get("lead") ?? "");
    const project = createProject({
      name,
      identifier: id,
      description: String(f.get("description") ?? ""),
      icon,
      is_public: isPublic,
      github_url: github,
      live_url: live,
      lead: lead || null,
    });
    onClose();
    router.push(`/projects/${project.id}/work-items`);
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <h2 className="text-base font-semibold">Create project</h2>

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
            autoFocus
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
          name="description"
          rows={2}
          placeholder="What is this project about? (optional)"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-github" className="mb-1 block text-xs font-medium text-neutral-600">
            Monitored GitHub repository URL
          </label>
          <input id="cp-github" name="github" type="url" placeholder="https://github.com/org/repo" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="cp-live" className="mb-1 block text-xs font-medium text-neutral-600">
            Production live URL
          </label>
          <input id="cp-live" name="live" type="url" placeholder="https://app.example.com" className={fieldClass} />
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
        <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
          Create project
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
