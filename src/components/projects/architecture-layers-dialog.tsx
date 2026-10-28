"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { splitStack, type ArchitectureLayer } from "@/lib/project-stack";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// The editable form of a layer: technologies are one comma-separated string while typing.
type Draft = { id: string; title: string; tag: string; summary: string; tech: string; flow: string };

const toDraft = (l: ArchitectureLayer): Draft => ({ id: l.id, title: l.title, tag: l.tag, summary: l.summary, tech: l.tech.join(", "), flow: l.flow });

function Editor({
  layers,
  isCustom,
  onSave,
  onReset,
  onClose,
}: {
  layers: ArchitectureLayer[];
  isCustom: boolean;
  onSave: (layers: ArchitectureLayer[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => layers.map(toDraft));
  const [error, setError] = useState<string | null>(null);

  const change = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const save = () => {
    const missing = drafts.findIndex((d) => !d.title.trim());
    if (missing >= 0) return setError(`Layer ${missing + 1} needs a title.`);
    onSave(
      drafts.map((d) => {
        const tech = splitStack(d.tech);
        return {
          id: d.id,
          title: d.title.trim(),
          tag: d.tag.trim(),
          summary: d.summary.trim(),
          tech: tech.length > 0 ? tech : ["Not specified yet"],
          flow: d.flow.trim(),
        };
      })
    );
    onClose();
  };

  return (
    <div className="flex max-h-[85vh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
        <h2 className="text-base font-semibold">Edit Architecture Layers</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-4 overflow-y-auto p-5">
        {drafts.map((d, i) => (
          <fieldset key={d.id} className="rounded-lg border border-neutral-200 p-3">
            <legend className="px-1 text-xs font-medium text-red-600">Layer {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div>
                <label htmlFor={`al-title-${d.id}`} className="mb-1 block text-xs font-medium text-neutral-600">Title</label>
                <input id={`al-title-${d.id}`} value={d.title} onChange={(e) => change(i, { title: e.target.value })} maxLength={80} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={`al-tag-${d.id}`} className="mb-1 block text-xs font-medium text-neutral-600">Tag</label>
                <input id={`al-tag-${d.id}`} value={d.tag} onChange={(e) => change(i, { tag: e.target.value })} maxLength={20} className={fieldClass} />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor={`al-summary-${d.id}`} className="mb-1 block text-xs font-medium text-neutral-600">Summary</label>
              <textarea id={`al-summary-${d.id}`} value={d.summary} onChange={(e) => change(i, { summary: e.target.value })} rows={2} className={`${fieldClass} resize-none`} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`al-tech-${d.id}`} className="mb-1 block text-xs font-medium text-neutral-600">Technologies <span className="font-normal text-neutral-400">(comma separated)</span></label>
                <input id={`al-tech-${d.id}`} value={d.tech} onChange={(e) => change(i, { tech: e.target.value })} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={`al-flow-${d.id}`} className="mb-1 block text-xs font-medium text-neutral-600">Data flow</label>
                <input id={`al-flow-${d.id}`} value={d.flow} onChange={(e) => change(i, { flow: e.target.value })} className={fieldClass} />
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <p role="alert" className="mx-5 mb-3 rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3">
        <button
          type="button"
          disabled={!isCustom}
          onClick={() => {
            onReset();
            onClose();
          }}
          title={isCustom ? "Go back to the layers derived from the project's stack" : "These layers have not been edited"}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset to Default
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            Save Changes
          </button>
        </div>
      </footer>
    </div>
  );
}

// Edits the four layers of the System Architecture. The draft is only written by "Save Changes".
export default function ArchitectureLayersDialog({
  open,
  onClose,
  layers,
  isCustom,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  layers: ArchitectureLayer[];
  isCustom: boolean;
  onSave: (layers: ArchitectureLayer[]) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Edit architecture layers"
      className="m-auto w-full max-w-2xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounting the editor only while open starts every edit from the current layers. */}
      {open && <Editor layers={layers} isCustom={isCustom} onSave={onSave} onReset={onReset} onClose={onClose} />}
    </dialog>
  );
}
