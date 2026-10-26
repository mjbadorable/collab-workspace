"use client";

import { useState, type ReactNode } from "react";
import { Link2Off } from "lucide-react";
import type { Align, CanvasNode, Direction, Distribute, SizeMode } from "@/lib/design-storage";
import { workItemKey, type StoredWorkItem } from "@/lib/work-items-storage";

type Patch = (patch: Partial<CanvasNode>) => void;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-neutral-100 disabled:text-neutral-400";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-1.5 py-1 text-xs ${
            value === o.value ? "bg-white font-medium text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberInput({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className={inputClass}
    />
  );
}

const sizeModes: { value: SizeMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "hug", label: "Hug" },
];

function Properties({ node, onPatch }: { node: CanvasNode; onPatch: Patch }) {
  const isFrame = node.type === "frame";
  const hasText = node.type === "text" || node.type === "button";
  const hex = /^#[0-9a-f]{6}$/i.test(node.fill) ? node.fill : "#000000";

  return (
    <div className="space-y-5 p-3">
      <Field label="Name">
        <input aria-label="Layer name" value={node.name} onChange={(e) => onPatch({ name: e.target.value })} className={inputClass} />
      </Field>

      {hasText && (
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <Field label="Text">
            <input aria-label="Text" value={node.text} onChange={(e) => onPatch({ text: e.target.value })} className={inputClass} />
          </Field>
          {node.type === "text" && (
            <Field label="Size">
              <NumberInput label="Font size" value={node.fontSize} onChange={(fontSize) => onPatch({ fontSize: fontSize || 1 })} />
            </Field>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Size</h3>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Field label="Width">
            <NumberInput label="Width" value={node.width} disabled={node.widthMode === "hug"} onChange={(width) => onPatch({ width })} />
          </Field>
          <Field label="Height">
            <NumberInput label="Height" value={node.height} disabled={node.heightMode === "hug"} onChange={(height) => onPatch({ height })} />
          </Field>
          <Segmented label="Width sizing" value={node.widthMode} options={sizeModes} onChange={(widthMode) => onPatch({ widthMode })} />
          <Segmented label="Height sizing" value={node.heightMode} options={sizeModes} onChange={(heightMode) => onPatch({ heightMode })} />
        </div>
      </section>

      {(isFrame || node.type === "button") && (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Auto layout</h3>
          {isFrame && (
            <Field label="Direction">
              <Segmented<Direction>
                label="Direction"
                value={node.direction}
                options={[
                  { value: "row", label: "Row" },
                  { value: "column", label: "Column" },
                ]}
                onChange={(direction) => onPatch({ direction })}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            {isFrame && (
              <Field label="Gap">
                <NumberInput label="Gap" value={node.gap} onChange={(gap) => onPatch({ gap })} />
              </Field>
            )}
            <Field label="Padding">
              <NumberInput label="Padding" value={node.padding} onChange={(padding) => onPatch({ padding })} />
            </Field>
          </div>
          {isFrame && (
            <>
              <Field label="Align">
                <Segmented<Align>
                  label="Align"
                  value={node.align}
                  options={[
                    { value: "start", label: "Start" },
                    { value: "center", label: "Center" },
                    { value: "end", label: "End" },
                  ]}
                  onChange={(align) => onPatch({ align })}
                />
              </Field>
              <Field label="Distribute">
                <Segmented<Distribute>
                  label="Distribute"
                  value={node.distribute}
                  options={[
                    { value: "start", label: "Start" },
                    { value: "center", label: "Center" },
                    { value: "end", label: "End" },
                    { value: "between", label: "Space" },
                  ]}
                  onChange={(distribute) => onPatch({ distribute })}
                />
              </Field>
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{node.type === "text" ? "Text color" : "Fill"}</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Fill color"
            value={hex}
            onChange={(e) => onPatch({ fill: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-neutral-300 bg-white p-0.5"
          />
          <input
            aria-label="Fill hex"
            value={node.fill}
            maxLength={7}
            onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onPatch({ fill: e.target.value })}
            className={`${inputClass} font-mono`}
          />
        </div>
      </section>
    </div>
  );
}

function LinkedTasks({ node, items, onPatch }: { node: CanvasNode; items: StoredWorkItem[]; onPatch: Patch }) {
  const linked = items.find((i) => i.id === node.linkedTaskId);
  const active = items
    .filter((i) => !i.deleted_at && i.status !== "done" && i.id !== node.linkedTaskId)
    .sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-4 p-3">
      <p className="text-sm text-neutral-600">
        Link <span className="font-medium">{node.name}</span> to a work item to track what it&apos;s for.
      </p>

      {node.linkedTaskId && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2.5">
          {linked ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-600">
                  {workItemKey(linked.project_id, linked.seq)}
                </span>
                <span className="truncate font-medium">{linked.title}</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {linked.deleted_at ? "In trash" : linked.status.replace("_", " ")}
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-600">The linked work item no longer exists.</p>
          )}
          <button
            type="button"
            onClick={() => onPatch({ linkedTaskId: null })}
            className="mt-2 flex items-center gap-1 text-xs text-neutral-600 hover:text-red-600"
          >
            <Link2Off className="h-3.5 w-3.5" /> Unlink
          </button>
        </div>
      )}

      <Field label={node.linkedTaskId ? "Link a different work item" : "Link a work item"}>
        {active.length === 0 ? (
          <p className="text-sm text-neutral-500">No other active work items in this project.</p>
        ) : (
          <select
            aria-label="Link a work item"
            value=""
            onChange={(e) => e.target.value && onPatch({ linkedTaskId: e.target.value })}
            className={inputClass}
          >
            <option value="">Select a work item…</option>
            {active.map((i) => (
              <option key={i.id} value={i.id}>
                {workItemKey(i.project_id, i.seq)} {i.title}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}

export default function PropertiesPanel({ node, items, onPatch }: { node: CanvasNode | null; items: StoredWorkItem[]; onPatch: Patch }) {
  const [tab, setTab] = useState<"properties" | "tasks">("properties");
  const tabs = [
    { value: "properties", label: "Properties" },
    { value: "tasks", label: "Linked tasks" },
  ] as const;

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-white">
      <div role="tablist" aria-label="Inspector" className="flex border-b border-neutral-200 px-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t.value ? "border-indigo-600 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {node ? (
        tab === "properties" ? (
          <Properties node={node} onPatch={onPatch} />
        ) : (
          <LinkedTasks node={node} items={items} onPatch={onPatch} />
        )
      ) : (
        <p className="p-4 text-sm text-neutral-500">Select a layer to edit its properties.</p>
      )}
    </div>
  );
}
