"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { FlowStep, FlowStepKind } from "@/lib/diagram-storage";

const KIND_OPTIONS: { value: FlowStepKind; label: string }[] = [
  { value: "terminal", label: "Start / End" },
  { value: "process", label: "Process" },
  { value: "decision", label: "Decision" },
];

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// New steps get a unique id of letters and digits only: it keys runbook notes and becomes a Mermaid node id.
const newStep = (): FlowStep => ({
  id: `n${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
  label: "",
  kind: "process",
  role: "",
  payload: "",
});

function Editor({
  steps,
  isCustom,
  onSave,
  onReset,
  onClose,
}: {
  steps: FlowStep[];
  isCustom: boolean;
  onSave: (steps: FlowStep[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FlowStep[]>(steps);
  const [error, setError] = useState<string | null>(null);

  const change = (index: number, patch: Partial<FlowStep>) =>
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const move = (index: number, by: -1 | 1) =>
    setDraft((prev) => {
      const target = index + by;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () => {
    const cleaned = draft.map((s) => ({ ...s, label: s.label.trim(), role: s.role.trim(), payload: s.payload.trim() }));
    if (cleaned.some((s) => !s.label)) return setError("Every step needs a label.");
    onSave(cleaned);
    onClose();
  };

  return (
    <div className="flex max-h-[85vh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
        <h2 className="text-base font-semibold">Edit Flow Steps</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <ol className="space-y-3 overflow-y-auto p-5">
        {draft.map((s, i) => (
          <li key={s.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">{i + 1}</span>
              <input
                value={s.label}
                onChange={(e) => change(i, { label: e.target.value })}
                aria-label={`Step ${i + 1} label`}
                placeholder="Step label"
                maxLength={80}
                className={fieldClass}
              />
              <select value={s.kind} onChange={(e) => change(i, { kind: e.target.value as FlowStepKind })} aria-label={`Step ${i + 1} kind`} className={`${fieldClass} w-36 shrink-0`}>
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <div className="flex shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label={`Move step ${i + 1} down`} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev.filter((_, j) => j !== i))}
                  disabled={draft.length === 1}
                  aria-label={`Delete step ${i + 1}`}
                  className="rounded p-1 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={s.role} onChange={(e) => change(i, { role: e.target.value })} aria-label={`Step ${i + 1} role`} placeholder="Role: what this step does" className={fieldClass} />
              <input value={s.payload} onChange={(e) => change(i, { payload: e.target.value })} aria-label={`Step ${i + 1} data payload`} placeholder="Data payload" className={`${fieldClass} font-mono text-xs`} />
            </div>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setDraft((prev) => [...prev, newStep()])} className="flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
            <Plus className="h-4 w-4" aria-hidden /> Add Step
          </button>
        </li>
      </ol>

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
          title={isCustom ? "Go back to the built-in flow" : "This flow has not been edited"}
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

// Edits the steps of one flow. The draft is thrown away on cancel and only written by "Save Changes".
export default function FlowStepsDialog({
  open,
  onClose,
  steps,
  isCustom,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  steps: FlowStep[];
  isCustom: boolean;
  onSave: (steps: FlowStep[]) => void;
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
      aria-label="Edit flow steps"
      className="m-auto w-full max-w-2xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounting the editor only while open starts every edit from the saved steps. */}
      {open && <Editor steps={steps} isCustom={isCustom} onSave={onSave} onReset={onReset} onClose={onClose} />}
    </dialog>
  );
}
