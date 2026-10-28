"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { Check, Code2, Copy, Maximize2 } from "lucide-react";
import { ProjectNotFound } from "@/components/projects/project-overview";
import {
  flowCategories,
  getFlow,
  getMermaidForCategory,
  parseFlowCategory,
  type FlowCategory,
  type FlowStep,
  type FlowStepKind,
} from "@/lib/diagram-storage";
import { useProjects } from "@/lib/projects-context";
import { useTheme } from "@/lib/theme";
import { useIsClient } from "@/lib/use-is-client";
import NodeInspector from "@/components/projects/node-inspector";

type StepData = { label: string; index: number; kind: FlowStepKind };
type StepNode = Node<StepData>;

const kindStyle: Record<FlowStepKind, { shape: string; tone: string; tag: string }> = {
  terminal: { shape: "rounded-full px-5", tone: "border-neutral-400 bg-neutral-100", tag: "Start / End" },
  process: { shape: "rounded-lg px-4", tone: "border-red-200 bg-white", tag: "Process" },
  decision: { shape: "rounded-lg px-4", tone: "border-amber-300 bg-amber-50", tag: "Decision" },
};

// Read-only: handles exist so edges attach, but nothing can be connected or edited.
function StepNodeView({ data, selected }: NodeProps<StepNode>) {
  const style = kindStyle[data.kind];
  return (
    <div
      className={`flex w-52 flex-col items-center gap-1 border-2 py-3 text-center shadow-sm ${style.shape} ${style.tone} ${
        selected ? "ring-2 ring-red-500 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="!bg-neutral-400" />
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-semibold text-white">
        {data.index}
      </span>
      <span className="text-sm font-medium leading-snug text-neutral-900">{data.label}</span>
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{style.tag}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="!bg-neutral-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = { terminal: StepNodeView, process: StepNodeView, decision: StepNodeView };

function MermaidDialog({ open, onClose, code }: { open: boolean; onClose: () => void; code: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the code stays selectable in the block below
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Raw Mermaid code"
      className="m-auto w-full max-w-2xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Raw Mermaid code</h2>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Paste into any Mermaid renderer or a Markdown doc.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed">
            <code>{code}</code>
          </pre>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function SequenceCard({ step, index, active, onSelect }: { step: FlowStep; index: number; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`h-full w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
          active ? "border-red-400 ring-1 ring-red-300" : "border-neutral-200"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
            {index + 1}
          </span>
          <span className="text-sm font-semibold leading-snug">{step.label}</span>
        </span>
        <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">Role</span>
        <span className="block text-sm text-neutral-700">{step.role}</span>
        <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">Data payload</span>
        <span className="block font-mono text-xs text-neutral-700">{step.payload}</span>
      </button>
    </li>
  );
}

function Viewer({ projectId, projectName, category }: { projectId: string; projectName: string; category: FlowCategory }) {
  const { fitView } = useReactFlow();
  const flow = useMemo(() => getFlow(projectId, category), [projectId, category]);
  const mermaid = useMemo(() => getMermaidForCategory(projectId, category), [projectId, category]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const { theme } = useTheme();

  const nodes = useMemo<StepNode[]>(
    () =>
      flow.steps.map((s, i) => ({
        id: s.id,
        type: s.kind,
        position: { x: i * 270, y: 0 },
        data: { label: s.label, index: i + 1, kind: s.kind },
        selected: s.id === selectedId,
        draggable: false,
        connectable: false,
      })),
    [flow, selectedId]
  );
  const edges = useMemo<Edge[]>(
    () =>
      flow.steps.slice(1).map((s, i) => ({
        id: `e-${flow.steps[i].id}-${s.id}`,
        source: flow.steps[i].id,
        target: s.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      })),
    [flow]
  );

  // Clicking a step (card or node) opens its runbook so edge cases can be documented on the flow itself.
  const inspect = (id: string) => setInspectedId(id);

  const select = (id: string) => {
    setSelectedId(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.1, padding: 0.6 });
    inspect(id);
  };

  const inspectedStep = flow.steps.find((s) => s.id === inspectedId) ?? null;

  const meta = flowCategories.find((c) => c.value === category)!;
  const base = `/projects/${projectId}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2 text-sm">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-neutral-500">
          <Link href="/projects" className="hover:text-neutral-900">
            Projects
          </Link>
          <span aria-hidden>›</span>
          <Link href={base} className="truncate hover:text-neutral-900">
            {projectName}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-neutral-900">Flowchart / Diagrams</span>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fitView({ duration: 300, padding: 0.2 })}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700 hover:bg-neutral-100"
          >
            <Maximize2 className="h-4 w-4" aria-hidden /> Fit to View
          </button>
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700"
          >
            <Code2 className="h-4 w-4" aria-hidden /> Raw Mermaid Code
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Flow category" className="flex flex-wrap gap-1 border-b border-neutral-200 bg-white px-4 py-2">
        {flowCategories.map((c) => (
          <Link
            key={c.value}
            role="tab"
            aria-selected={category === c.value}
            href={`${base}/diagrams?category=${c.value}`}
            replace
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
              category === c.value ? "bg-red-50 font-medium text-red-700" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <span aria-hidden>{c.emoji}</span> {c.label}
          </Link>
        ))}
      </div>

      <p className="px-4 pt-3 text-sm text-neutral-500">
        <span className="font-medium text-neutral-800">{meta.label}</span> · {meta.title}
      </p>

      <div className="mx-4 mt-3 h-[26rem] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnScroll
          fitView
          fitViewOptions={{ padding: 0.2 }}
          colorMode={theme}
          onNodeClick={(_, node) => {
            setSelectedId(node.id);
            inspect(node.id);
          }}
          onPaneClick={() => setSelectedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <section aria-label="Step-by-step sequence" className="px-4 py-6">
        <h2 className="text-sm font-semibold text-neutral-700">Step-by-step sequence</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flow.steps.map((s, i) => (
            <SequenceCard key={s.id} step={s} index={i} active={s.id === selectedId} onSelect={() => select(s.id)} />
          ))}
        </ol>
      </section>

      {inspectedStep && (
        <NodeInspector
          key={`${category}:${inspectedStep.id}`}
          projectId={projectId}
          nodeId={`${category}:${inspectedStep.id}`}
          nodeTitle={inspectedStep.label}
          nodeKind={`${meta.label} · ${kindStyle[inspectedStep.kind].tag}`}
          defaultNotes={[
            inspectedStep.role,
            `Data payload: ${inspectedStep.payload}`,
            "",
            "Edge cases to document:",
            "- ",
          ].join("\n")}
          onClose={() => setInspectedId(null)}
        />
      )}

      <MermaidDialog open={showCode} onClose={() => setShowCode(false)} code={mermaid} />
    </div>
  );
}

// Reads ?category=user|system|backend (the page wraps this in Suspense) and shows that flow read-only.
export default function DiagramEditor({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const category = parseFlowCategory(useSearchParams().get("category"));
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;
  return (
    <ReactFlowProvider key={`${projectId}:${category}`}>
      <Viewer projectId={projectId} projectName={project.name} category={category} />
    </ReactFlowProvider>
  );
}
