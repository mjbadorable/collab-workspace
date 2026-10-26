"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWorkspaces } from "@/lib/workspace-context";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);

function CreateForm({ onDone, onSkip, first }: { onDone: () => void; onSkip: () => void; first: boolean }) {
  const { create } = useWorkspaces();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const finalSlug = slug.replace(/-+$/, "");
    if (!name.trim() || !finalSlug) return;
    setBusy(true);
    setError(null);
    const message = await create(name.trim(), finalSlug);
    setBusy(false);
    if (message) setError(message);
    else onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">{first ? "Create your workspace" : "New workspace"}</h2>
        {first && <p className="mt-1 text-sm text-neutral-500">A workspace holds your projects, work items and designs.</p>}
      </div>
      <div>
        <label htmlFor="ws-name" className="mb-1 block text-xs font-medium text-neutral-600">
          Name
        </label>
        <input
          id="ws-name"
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="ws-slug" className="mb-1 block text-xs font-medium text-neutral-600">
          Slug
        </label>
        <input
          id="ws-slug"
          required
          maxLength={40}
          pattern="[a-z0-9]+(-[a-z0-9]+)*-?"
          title="Lowercase letters, numbers and hyphens"
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          className={`${fieldClass} font-mono`}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onSkip} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
          {first ? "Continue with local preview" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </div>
    </form>
  );
}

// Opens by itself for a signed-in user with no workspaces, and on demand from the workspace switcher.
export default function WorkspaceDialog({ requested, onClose }: { requested: boolean; onClose: () => void }) {
  const { needsOnboarding } = useWorkspaces();
  const [skipped, setSkipped] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = requested || (needsOnboarding && !skipped);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setSkipped(true);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-label="Create workspace"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && <CreateForm first={needsOnboarding} onDone={onClose} onSkip={close} />}
    </dialog>
  );
}
