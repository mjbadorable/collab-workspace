"use client";

import { useState } from "react";
import { Frame, Link2, Pencil, Plus, RectangleHorizontal, Square, Trash2, Type, type LucideIcon } from "lucide-react";
import type { CanvasNode, DesignPage, NodeType } from "@/lib/design-storage";

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

function PageRow({
  page,
  active,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  page: DesignPage;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    const finish = (value: string) => {
      setRenaming(false);
      onRename(value);
    };
    return (
      <li>
        <input
          aria-label="Page name"
          autoFocus
          defaultValue={page.name}
          maxLength={40}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => finish(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish(e.currentTarget.value);
            // Cancelling re-applies the old name; blur then fires with the same value.
            else if (e.key === "Escape") finish(page.name);
          }}
          className="w-full rounded border border-indigo-400 bg-white px-2 py-1 text-sm outline-none"
        />
      </li>
    );
  }

  return (
    <li
      className={`group flex items-center gap-1 rounded pr-1 ${active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => setRenaming(true)}
        aria-current={active ? "page" : undefined}
        title="Double-click to rename"
        className="min-w-0 flex-1 truncate px-2 py-1 text-left text-sm"
      >
        {page.name}
      </button>
      <button
        type="button"
        onClick={() => setRenaming(true)}
        aria-label={`Rename ${page.name}`}
        className="rounded p-1 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-700 focus:opacity-100 group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${page.name}`}
          className="rounded p-1 text-neutral-400 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      )}
    </li>
  );
}

export default function LayersTree({
  pages,
  activePageId,
  nodes,
  selectedId,
  onSelect,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
}: {
  pages: DesignPage[];
  activePageId: string;
  nodes: CanvasNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white">
      <section className="border-b border-neutral-200 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pages</h2>
          <button
            type="button"
            onClick={onAddPage}
            aria-label="Add page"
            title="Add page"
            className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="mt-1 space-y-0.5">
          {pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              active={page.id === activePageId}
              canDelete={pages.length > 1}
              onSelect={() => onSelectPage(page.id)}
              onRename={(name) => onRenamePage(page.id, name)}
              onDelete={() => onDeletePage(page.id)}
            />
          ))}
        </ul>
      </section>
      <section className="p-3">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Layers</h2>
        {nodes.length === 0 ? (
          <p className="text-sm text-neutral-500">Empty page. Pick a Frame or a device preset to start.</p>
        ) : (
          <ul>
            {nodes.map((node) => (
              <Layer key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
