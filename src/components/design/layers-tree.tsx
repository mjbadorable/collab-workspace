"use client";

import { Frame, Link2, RectangleHorizontal, Square, Type, type LucideIcon } from "lucide-react";
import type { CanvasNode, NodeType } from "@/lib/design-storage";

const icons: Record<NodeType, LucideIcon> = {
  frame: Frame,
  rectangle: Square,
  text: Type,
  button: RectangleHorizontal,
};

function Layer({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: CanvasNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const Icon = icons[node.type];
  const active = node.id === selectedId;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        aria-current={active}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left text-sm ${
          active ? "bg-indigo-100 text-indigo-900" : "text-neutral-700 hover:bg-neutral-100"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
        <span className="flex-1 truncate">{node.name}</span>
        {node.linkedTaskId && <Link2 className="h-3 w-3 shrink-0 text-indigo-500" aria-label="Linked to a task" />}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <Layer key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LayersTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: CanvasNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white">
      <section className="border-b border-neutral-200 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pages</h2>
          <button
            type="button"
            disabled
            title="Multiple pages are not supported yet"
            aria-label="Add page"
            className="rounded px-1 text-neutral-300"
          >
            +
          </button>
        </div>
        <p className="mt-1 rounded bg-neutral-100 px-2 py-1 text-sm font-medium">Page 1</p>
      </section>
      <section className="p-3">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Layers</h2>
        <ul>
          {nodes.map((node) => (
            <Layer key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      </section>
    </div>
  );
}
