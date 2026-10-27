"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Frame,
  Hand,
  Minus,
  Monitor,
  MousePointer2,
  Plus,
  Smartphone,
  Square,
  Tablet,
  Trash2,
  TriangleAlert,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  addChildNode,
  addPage,
  deleteNode,
  deletePage,
  devicePresets,
  duplicateNode,
  findNode,
  findParentId,
  loadDesignFile,
  makeNode,
  renamePage,
  saveDesignFile,
  updateNode,
  type CanvasNode,
  type DesignFile,
} from "@/lib/design-storage";
import { mockUser } from "@/lib/mock-data";
import { useIsClient } from "@/lib/use-is-client";
import { loadWorkItems } from "@/lib/work-items-storage";
import CanvasNodeView from "./canvas-node";
import LayersTree from "./layers-tree";
import PropertiesPanel from "./properties-panel";

type Tool = "frame" | "rectangle" | "text" | "hand" | "select";
type View = { x: number; y: number; z: number };

const tools: { value: Tool; label: string; key: string; icon: LucideIcon }[] = [
  { value: "frame", label: "Frame", key: "F", icon: Frame },
  { value: "rectangle", label: "Rectangle", key: "R", icon: Square },
  { value: "text", label: "Text", key: "T", icon: Type },
  { value: "hand", label: "Hand", key: "H", icon: Hand },
  { value: "select", label: "Select", key: "V", icon: MousePointer2 },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function Editor({ projectId, initial }: { projectId: string; initial: DesignFile }) {
  const [file, setFile] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [items] = useState(() => loadWorkItems(projectId));
  const [activePageId, setActivePageId] = useState(initial.pages[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(initial.pages[0].nodes[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>({ x: 80, y: 70, z: 0.5 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  const page = file.pages.find((p) => p.id === activePageId) ?? file.pages[0];
  const nodes = page.nodes;
  const selected = selectedId ? findNode(nodes, selectedId) : null;
  const latest = useRef({ remove: () => {}, duplicate: () => {} });

  // Every change is saved straight away, so the "Saved" indicator only turns off if storage fails.
  const commit = (next: DesignFile) => {
    const stamped = { ...next, updated_at: new Date().toISOString(), updated_by: mockUser.name };
    setFile(stamped);
    setSaved(saveDesignFile(stamped));
  };
  const edit = (fn: (nodes: CanvasNode[]) => CanvasNode[]) =>
    commit({ ...file, pages: file.pages.map((p) => (p.id === page.id ? { ...p, nodes: fn(p.nodes) } : p)) });

  const switchPage = (id: string) => {
    setActivePageId(id);
    setSelectedId(null);
    setEditingId(null);
  };
  const onAddPage = () => {
    const next = addPage(file);
    commit(next);
    switchPage(next.pages[next.pages.length - 1].id);
  };
  const onDeletePage = (id: string) => {
    const doomed = file.pages.find((p) => p.id === id);
    if (!doomed || (doomed.nodes.length > 0 && !window.confirm(`Delete "${doomed.name}" and its layers?`))) return;
    const next = deletePage(file, id);
    commit(next);
    if (id === page.id) switchPage(next.pages[0].id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    edit((list) => deleteNode(list, selectedId));
    setSelectedId(null);
    setEditingId(null);
  };
  const duplicateSelected = () => {
    if (!selectedId) return;
    const result = duplicateNode(nodes, selectedId);
    if (!result.newId) return;
    edit(() => result.nodes);
    setSelectedId(result.newId);
  };

  // Resizes the selected top-level frame to the device, or adds a new frame beside the existing ones.
  const applyPreset = (preset: (typeof devicePresets)[number]) => {
    const size = { widthMode: "fixed", heightMode: "fixed", width: preset.width, height: preset.height } as const;
    if (selected && selected.type === "frame" && nodes.some((n) => n.id === selected.id)) {
      patchNode(selected.id, size);
      return;
    }
    const right = nodes.reduce((max, n) => Math.max(max, n.x + (n.widthMode === "fixed" ? n.width : 400)), -80);
    const frame = makeNode("frame", { name: `${preset.label} · ${preset.width}×${preset.height}`, x: right + 80, y: 0, ...size });
    edit((list) => [...list, frame]);
    setSelectedId(frame.id);
  };
  const patchNode = (id: string, patch: Partial<CanvasNode>) => edit((nodes) => updateNode(nodes, id, patch));

  // Native listener: React's onWheel is passive and cannot stop the page from scrolling.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setView((v) => {
          const z = clamp(v.z * Math.exp(-e.deltaY * 0.002), 0.1, 4);
          const r = z / v.z;
          return { z, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // The key listener is registered once, so it reaches the current handlers through a ref.
  useEffect(() => {
    latest.current = { remove: removeSelected, duplicate: duplicateSelected };
  });

  useEffect(() => {
    const shortcuts: Record<string, Tool> = { f: "frame", r: "rectangle", t: "text", h: "hand", v: "select" };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault(); // otherwise the browser bookmarks the page
        latest.current.duplicate();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        latest.current.remove();
        return;
      }
      const next = shortcuts[e.key.toLowerCase()];
      if (next) setTool(next);
      else if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const zoomBy = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setView((v) => {
      const z = clamp(v.z * factor, 0.1, 4);
      const r = z / v.z;
      return { z, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  };

  const insert = (e: PointerEvent<HTMLDivElement>, hitId: string | null) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (tool === "frame") {
      const x = Math.round((e.clientX - rect.left - view.x) / view.z);
      const y = Math.round((e.clientY - rect.top - view.y) / view.z);
      const frame = makeNode("frame", {
        name: `Frame ${nodes.length + 1}`,
        x,
        y,
        widthMode: "fixed",
        heightMode: "fixed",
        width: 400,
        height: 300,
      });
      edit((nodes) => [...nodes, frame]);
      setSelectedId(frame.id);
    } else {
      // Rectangles and text go into the frame that was clicked, else the selection's frame, else the first frame.
      const base = hitId ?? selectedId;
      const baseNode = base ? findNode(nodes, base) : null;
      const parentId =
        (baseNode?.type === "frame" ? baseNode.id : base ? findParentId(nodes, base) : null) ?? nodes[0]?.id;
      if (parentId) {
        const child = makeNode(tool === "text" ? "text" : "rectangle");
        edit((nodes) => addChildNode(nodes, parentId, child));
        setSelectedId(child.id);
      }
    }
    setTool("select");
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    const hitId = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null;
    const panning = e.button === 1 || tool === "hand" || (tool === "select" && !hitId);
    if (panning) {
      if (tool === "select" && !hitId) setSelectedId(null);
      panRef.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (tool === "select") {
      setSelectedId(hitId);
    } else {
      insert(e, hitId);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan) setView((v) => ({ ...v, x: pan.vx + e.clientX - pan.px, y: pan.vy + e.clientY - pan.py }));
  };

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    const node = id ? findNode(nodes, id) : null;
    if (node && (node.type === "text" || node.type === "button")) {
      setSelectedId(node.id);
      setEditingId(node.id);
    }
  };

  const cursor = tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";
  const dot = 20 * view.z;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-3 py-1.5 text-sm">
        <div className="flex min-w-0 items-center gap-1">
          <Link href={`/projects/${projectId}`} aria-label="Back to project overview" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="truncate font-medium">{file.name}</span>
        </div>

        <div role="toolbar" aria-label="Tools" className="flex gap-0.5">
          {tools.map(({ value, label, key, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={tool === value}
              aria-label={`${label} (${key})`}
              title={`${label} (${key})`}
              onClick={() => setTool(value)}
              className={`rounded p-1.5 ${tool === value ? "bg-indigo-100 text-indigo-700" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div role="group" aria-label="Device presets" className="flex items-center gap-0.5">
          {devicePresets.map((preset) => {
            const Icon = preset.value === "desktop" ? Monitor : preset.value === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset)}
                title={`${preset.label} ${preset.width}×${preset.height}: resizes the selected frame, or adds a new one`}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                <Icon className="h-4 w-4" aria-hidden /> <span className="hidden xl:inline">{preset.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selected}
            aria-label="Delete selected layer"
            title="Delete selected layer (Delete)"
            className="ml-1 rounded p-1.5 text-red-600 hover:bg-red-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className="rounded p-1 text-neutral-600 hover:bg-neutral-100">
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Reset zoom to 100%"
              onClick={() => zoomBy(1 / view.z)}
              className="w-12 rounded py-1 text-center text-xs tabular-nums text-neutral-700 hover:bg-neutral-100"
            >
              {Math.round(view.z * 100)}%
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="rounded p-1 text-neutral-600 hover:bg-neutral-100">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span
            role="status"
            className={`flex items-center gap-1 text-xs ${saved ? "text-neutral-500" : "text-red-600"}`}
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {saved ? "Saved" : "Not saved"}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <LayersTree
          pages={file.pages}
          activePageId={page.id}
          nodes={nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSelectPage={switchPage}
          onAddPage={onAddPage}
          onRenamePage={(id, name) => commit(renamePage(file, id, name))}
          onDeletePage={onDeletePage}
        />

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (panRef.current = null)}
          onPointerCancel={() => (panRef.current = null)}
          onDoubleClick={onDoubleClick}
          className="relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-neutral-100"
          style={{
            cursor,
            backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)",
            backgroundSize: `${dot}px ${dot}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
          >
            {nodes.map((node) => (
              <CanvasNodeView
                key={node.id}
                node={node}
                root
                zoom={view.z}
                selectedId={selectedId}
                editingId={editingId}
                onTextChange={(id, text) => patchNode(id, { text })}
                onStopEditing={() => setEditingId(null)}
              />
            ))}
          </div>
        </div>

        <PropertiesPanel
          node={selected}
          items={items}
          onPatch={(patch) => selectedId && patchNode(selectedId, patch)}
          onDelete={removeSelected}
        />
      </div>
    </div>
  );
}

function LoadedEditor({ projectId, fileId }: { projectId: string; fileId: string }) {
  const [initial] = useState(() => loadDesignFile(fileId));
  if (!initial || initial.project_id !== projectId || initial.deleted_at) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium">Design file not found</p>
        <Link href={`/projects/${projectId}`} className="mt-2 text-sm text-red-600 hover:underline">
          Back to project overview
        </Link>
      </div>
    );
  }
  return <Editor projectId={projectId} initial={initial} />;
}

export default function DesignEditor({ projectId, fileId }: { projectId: string; fileId: string }) {
  const mounted = useIsClient();
  return mounted ? <LoadedEditor projectId={projectId} fileId={fileId} /> : <div className="h-full" />;
}
