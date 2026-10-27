"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import {
  ChevronRight,
  Circle,
  Diamond,
  Download,
  Hand,
  MousePointer2,
  Square,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { ensureCloudProject } from "@/lib/cloud-projects";
import {
  defaultDiagram,
  fetchCloudDiagram,
  loadDiagram,
  saveCloudDiagram,
  saveDiagram,
  toStored,
  type StoredDiagram,
} from "@/lib/diagram-storage";
import { mockProjects } from "@/lib/mock-data";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { nodeTypes, type DiagramNode } from "./nodes";

type Tool = "select" | "hand";

const shapes: { type: string; label: string; icon: LucideIcon; data: DiagramNode["data"]; size: [number, number] }[] = [
  { type: "process", label: "Process", icon: Square, data: { label: "Process" }, size: [144, 48] },
  { type: "decision", label: "Decision", icon: Diamond, data: { label: "Decision?" }, size: [160, 96] },
  { type: "terminal", label: "Start / End", icon: Circle, data: { label: "Start" }, size: [112, 48] },
  { type: "text", label: "Text note", icon: Type, data: { label: "Note" }, size: [60, 28] },
  { type: "entity", label: "Table", icon: Table2, data: { label: "table_name", fields: ["id: uuid", "name: text"] }, size: [208, 100] },
];

const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed } };

type EditorProps = {
  projectId: string;
  initial: StoredDiagram;
  // Resolves to false when the write failed.
  onSave: (diagram: StoredDiagram) => Promise<boolean>;
  cloud: boolean;
};

function Editor({ projectId, initial, onSave, cloud }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [tool, setTool] = useState<Tool>("select");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const added = useRef(0);
  const { screenToFlowPosition } = useReactFlow();

  const snapshot = useMemo(() => JSON.stringify(toStored(nodes, edges)), [nodes, edges]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toStored(initial.nodes, initial.edges)));
  const [failedSnapshot, setFailedSnapshot] = useState<string | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Debounced autosave (400ms), so a drag becomes one write rather than one per pixel.
  useEffect(() => {
    if (snapshot === savedSnapshot) return;
    const t = setTimeout(async () => {
      const ok = await onSaveRef.current(JSON.parse(snapshot));
      if (ok) setSavedSnapshot(snapshot);
      else setFailedSnapshot(snapshot);
    }, 400);
    return () => clearTimeout(t);
  }, [snapshot, savedSnapshot]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es)), [setEdges]);

  const addNode = (shape: (typeof shapes)[number]) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const nudge = (added.current++ % 6) * 24;
    const node: DiagramNode = {
      id: crypto.randomUUID(),
      type: shape.type,
      position: { x: center.x - shape.size[0] / 2 + nudge, y: center.y - shape.size[1] / 2 + nudge },
      data: { ...shape.data },
      selected: true,
    };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
    setTool("select");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toStored(nodes, edges), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId}-diagram.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const projectName = mockProjects.find((p) => p.id === projectId)?.name ?? projectId;
  const saved = snapshot === savedSnapshot;
  const failed = !saved && snapshot === failedSnapshot;
  const hand = tool === "hand";

  const toolButton = (active: boolean) =>
    `rounded-md p-2 transition-colors ${active ? "bg-indigo-100 text-indigo-700" : "text-neutral-600 hover:bg-neutral-100"}`;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-2 text-sm">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-neutral-500">
          <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{projectName}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href={`/projects/${projectId}/diagrams`} className="hover:text-neutral-900">Diagrams</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium text-neutral-900">User flow</span>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-neutral-500">{cloud ? "Cloud" : "Local preview"}</span>
          <span
            role="status"
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              saved
                ? "bg-emerald-50 text-emerald-700"
                : failed
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {saved ? "Saved" : failed ? "Not saved" : "Saving…"}
          </span>
          <button
            type="button"
            onClick={exportJson}
            aria-label="Export diagram as JSON"
            title="Export JSON"
            className="rounded-md border border-neutral-200 p-1.5 text-neutral-600 hover:bg-neutral-100"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative flex-1">
        <div ref={wrapperRef} className={`absolute inset-0 ${hand ? "[&_.react-flow__pane]:!cursor-grab" : ""}`}>
          <ReactFlow
            className="h-full w-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={["Backspace", "Delete"]}
            panOnDrag={hand ? true : [1, 2]}
            selectionOnDrag={!hand}
            nodesDraggable={!hand}
            nodesConnectable={!hand}
            elementsSelectable={!hand}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap position="bottom-right" pannable zoomable />
          </ReactFlow>
        </div>

        <div
          role="toolbar"
          aria-label="Shapes"
          className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-md"
        >
          <button type="button" aria-label="Pan" title="Pan" onClick={() => setTool("hand")} className={toolButton(hand)}>
            <Hand className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Select" title="Select" onClick={() => setTool("select")} className={toolButton(!hand)}>
            <MousePointer2 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-200" />
          {shapes.map((s) => (
            <button
              key={s.type}
              type="button"
              aria-label={`Add ${s.label}`}
              title={s.label}
              onClick={() => addNode(s)}
              className={toolButton(false)}
            >
              <s.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Loads the diagram from the cloud or localStorage, then mounts the editor with it.
function DiagramLoader({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const [localInitial] = useState(() => (workspaceId ? null : (loadDiagram(projectId) ?? defaultDiagram(projectId))));
  const [cloudInitial, setCloudInitial] = useState<StoredDiagram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cloudRef = useRef<{ projectUuid: string; diagramId: string | null } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const projectUuid = await ensureCloudProject(workspaceId, projectId);
        const found = await fetchCloudDiagram(projectUuid);
        if (cancelled) return;
        cloudRef.current = { projectUuid, diagramId: found?.id ?? null };
        // With no saved row yet, show the starter flow; the row is only created on the first edit.
        setCloudInitial(found?.diagram ?? defaultDiagram(projectId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the diagram.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  const onSave = async (diagram: StoredDiagram): Promise<boolean> => {
    if (!workspaceId) {
      saveDiagram(projectId, diagram);
      return true;
    }
    const ref = cloudRef.current;
    if (!ref) return false;
    try {
      ref.diagramId = await saveCloudDiagram(ref.projectUuid, ref.diagramId, diagram);
      return true;
    } catch {
      return false;
    }
  };

  const initial = workspaceId ? cloudInitial : localInitial;
  if (error) {
    return (
      <p role="alert" className="m-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!initial) return <p className="px-6 py-16 text-center text-sm text-neutral-500">Loading diagram…</p>;
  return (
    <ReactFlowProvider>
      <Editor projectId={projectId} initial={initial} onSave={onSave} cloud={!!workspaceId} />
    </ReactFlowProvider>
  );
}

// localStorage only exists in the browser, so the editor mounts after hydration
// to keep the server HTML and first client render identical.
export default function DiagramEditor({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <div className="h-full w-full" />;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return <DiagramLoader key={workspaceId ?? "local"} projectId={projectId} workspaceId={workspaceId} />;
}
