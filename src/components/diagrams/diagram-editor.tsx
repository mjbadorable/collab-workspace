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
  RefreshCw,
  Square,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { defaultDiagram, loadDiagram, saveDiagram, toStored } from "@/lib/diagram-storage";
import { mockProjects } from "@/lib/mock-data";
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

function Editor({ projectId }: { projectId: string }) {
  const [initial] = useState(() => loadDiagram(projectId) ?? defaultDiagram(projectId));
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [tool, setTool] = useState<Tool>("select");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const added = useRef(0);
  const { screenToFlowPosition } = useReactFlow();

  const snapshot = useMemo(() => JSON.stringify(toStored(nodes, edges)), [nodes, edges]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toStored(initial.nodes, initial.edges)));

  // Debounced autosave to localStorage.
  useEffect(() => {
    if (snapshot === savedSnapshot) return;
    const t = setTimeout(() => {
      saveDiagram(projectId, JSON.parse(snapshot));
      setSavedSnapshot(snapshot);
    }, 400);
    return () => clearTimeout(t);
  }, [snapshot, savedSnapshot, projectId]);

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
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              saved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {saved ? "Saved" : "Saving…"}
          </span>
          <button
            type="button"
            disabled
            title="Cloud sync arrives with the Supabase integration"
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-neutral-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Sync
          </button>
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

// localStorage only exists in the browser, so the editor mounts after hydration
// to keep the server HTML and first client render identical.
export default function DiagramEditor({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  if (!mounted) return <div className="h-full w-full" />;
  return (
    <ReactFlowProvider>
      <Editor projectId={projectId} />
    </ReactFlowProvider>
  );
}
