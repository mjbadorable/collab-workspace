"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Frame, Hand, MousePointer2, Minus, Plus, Square, TriangleAlert, Type, type LucideIcon } from "lucide-react";
import {
  addChildNode,
  findNode,
  findParentId,
  loadDesignFile,
  makeNode,
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
  const [selectedId, setSelectedId] = useState<string | null>(initial.nodes[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>({ x: 80, y: 70, z: 0.5 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  const selected = selectedId ? findNode(file.nodes, selectedId) : null;

  // Every change is saved straight away, so the "Saved" indicator only turns off if storage fails.
  const edit = (fn: (nodes: CanvasNode[]) => CanvasNode[]) => {
    const next = { ...file, nodes: fn(file.nodes), updated_at: new Date().toISOString(), updated_by: mockUser.name };
    setFile(next);
    setSaved(saveDesignFile(next));
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

  useEffect(() => {
    const shortcuts: Record<string, Tool> = { f: "frame", r: "rectangle", t: "text", h: "hand", v: "select" };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
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
        name: `Frame ${file.nodes.length + 1}`,
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
      const baseNode = base ? findNode(file.nodes, base) : null;
      const parentId =
        (baseNode?.type === "frame" ? baseNode.id : base ? findParentId(file.nodes, base) : null) ?? file.nodes[0]?.id;
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
    const node = id ? findNode(file.nodes, id) : null;
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
          <Link href="/design" aria-label="Back to design files" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
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
        <LayersTree nodes={file.nodes} selectedId={selectedId} onSelect={setSelectedId} />

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
            {file.nodes.map((node) => (
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
        <Link href="/design" className="mt-2 text-sm text-indigo-600 hover:underline">
          Back to design files
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
