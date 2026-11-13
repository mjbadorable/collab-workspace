"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, Globe, HeartPulse, Pencil, Rocket, Workflow } from "lucide-react";
import {
  architectureLayers,
  hasCustomArchitectureLayers,
  hostingOf,
  resetCustomArchitectureLayers,
  saveCustomArchitectureLayers,
  type ArchitectureLayer,
} from "@/lib/project-stack";
import ArchitectureLayersDialog from "./architecture-layers-dialog";
import NodeInspector from "./node-inspector";
import type { ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";
import { ProjectNotFound } from "./project-overview";

type Mode = "visual" | "raw";

const modes: { value: Mode; label: string }[] = [
  { value: "visual", label: "Visual Schematic" },
  { value: "raw", label: "Raw Specification / Mermaid" },
];

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">{children}</span>
  );
}

// A vertical wire between two cards, labelled with the protocol that crosses it.
function Wire({ tags, up = false }: { tags: string[]; up?: boolean }) {
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-neutral-400" aria-hidden>
      <span className="h-6 w-px bg-neutral-300" />
      <Arrow className="h-4 w-4" />
      <span className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </span>
    </div>
  );
}

const LAYER_SHORT: Record<string, string> = { ui: "UI", state: "State", engine: "Engine / Workers", storage: "Storage / Cache" };
const shortName = (layer: ArchitectureLayer) => LAYER_SHORT[layer.id] ?? layer.tag;

// A directional connector between two layers: a solid line with an arrowhead, the hand-off it carries, and the protocol tags.
function LayerConnector({ from, to, tags }: { from: ArchitectureLayer; to: ArchitectureLayer; tags: string[] }) {
  return (
    <div role="img" aria-label={`${shortName(from)} flows to ${shortName(to)}`} className="flex flex-col items-center py-1.5">
      <span className="h-4 w-0.5 rounded-full bg-red-300" aria-hidden />
      <span className="flex flex-wrap items-center justify-center gap-1.5 py-0.5" aria-hidden>
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          {shortName(from)} → {shortName(to)}
        </span>
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </span>
      <ArrowDown className="-mt-0.5 h-4 w-4 text-red-400" aria-hidden />
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="mt-2 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-700">
          {t}
        </span>
      ))}
    </span>
  );
}

function LayerCard({
  layer,
  selected,
  onSelect,
  onInspect,
}: {
  layer: ArchitectureLayer;
  selected: boolean;
  onSelect: (layer: ArchitectureLayer) => void;
  onInspect: (layer: ArchitectureLayer) => void;
}) {
  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm transition ${selected ? "border-red-400 ring-2 ring-red-200" : "border-neutral-200"}`}>
      <button
        type="button"
        aria-pressed={selected}
        data-layer-id={layer.id}
        onClick={() => onSelect(layer)}
        className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <span className="block text-[11px] font-medium uppercase tracking-wide text-red-600">{layer.tag}</span>
        <span className="block text-sm font-semibold">{layer.title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{layer.summary}</span>
      </button>
      <Chips items={layer.tech} />
      <button
        type="button"
        onClick={() => onInspect(layer)}
        className="mt-3 text-xs font-medium text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        Inspect Layer &amp; Runbook →
      </button>
    </div>
  );
}

// Starting point for a layer's runbook; once the user edits it, their version is kept instead.
function layerRunbook(layer: ArchitectureLayer): string {
  return [
    `${layer.title} (${layer.tag})`,
    layer.summary,
    "",
    `Technologies: ${layer.tech.join(", ")}`,
    `Data flow: ${layer.flow}`,
    "",
    "Failure modes & recovery:",
    "- ",
    "",
    "Edge cases to remember:",
    "- ",
    "",
    "Who to ask / where to look first:",
    "- ",
  ].join("\n");
}

function InfraCard({ icon: Icon, title, detail }: { icon: typeof Rocket; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-red-600" aria-hidden /> {title}
      </h3>
      <p className="mt-1 break-words text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

const q = (text: string) => text.replace(/"/g, "'");

// Mermaid flowchart for the same architecture, so it can be pasted into docs or a Mermaid renderer.
function mermaidSpec(project: ProjectRecord, layers: ArchitectureLayer[]): string {
  const host = hostingOf(project.live_url) ?? "Production Host";
  const node = (l: ArchitectureLayer, id: string) => `    ${id}["${q(l.title)}<br/>${q(l.tech.join(", "))}"]`;
  return [
    `%% ${project.name} (${project.identifier}) - system architecture`,
    "flowchart TB",
    '  subgraph Browser["Browser (client-side, offline-first)"]',
    node(layers[0], "UI"),
    node(layers[1], "State"),
    node(layers[2], "Workers"),
    node(layers[3], "Storage"),
    "  end",
    '  subgraph DevOps["DevOps & Production Hosting"]',
    `    Repo["GitHub Repository${project.github_url ? `<br/>${q(project.github_url)}` : ""}"]`,
    '    CI["CI/CD pipeline"]',
    `    Prod["${q(host)} (production)${project.live_url ? `<br/>${q(project.live_url)}` : ""}"]`,
    '    Health["Silph DevOps Health Monitor"]',
    "  end",
    '  UI <-->|"0ms Optimistic"| State',
    '  State <-->|"postMessage"| Workers',
    '  State -->|"IndexedDB Tx"| Storage',
    '  Workers -->|"IndexedDB Tx"| Storage',
    '  Repo -->|"git push"| CI',
    '  CI -->|"HTTPS deploy"| Prod',
    '  Health -->|"HTTPS Ping"| Prod',
    '  Prod -->|"HTTPS static assets"| Storage',
  ].join("\n");
}

function Schematic({
  project,
  layers,
  selectedId,
  onSelect,
  onInspect,
}: {
  project: ProjectRecord;
  layers: ArchitectureLayer[];
  selectedId: string;
  onSelect: (layer: ArchitectureLayer) => void;
  onInspect: (layer: ArchitectureLayer) => void;
}) {
  const host = hostingOf(project.live_url);
  const card = (layer: ArchitectureLayer) => (
    <LayerCard layer={layer} selected={layer.id === selectedId} onSelect={onSelect} onInspect={onInspect} />
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // Up / Down move the selection to the neighbouring layer while a layer button has focus.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-layer-id]")) return;
    const index = layers.findIndex((l) => l.id === selectedId);
    const next = layers[index + (e.key === "ArrowDown" ? 1 : -1)];
    e.preventDefault();
    if (!next) return;
    onSelect(next);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-layer-id="${next.id}"]`)?.focus());
  };

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-label="Client-side boundary" className="rounded-xl border-2 border-dashed border-neutral-300 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Globe className="h-3.5 w-3.5" aria-hidden /> Browser · client-side, offline-first boundary
            <span className="ml-auto hidden font-normal normal-case tracking-normal text-neutral-400 sm:inline">↑ ↓ to move between layers</span>
          </p>
          {card(layers[0])}
          <LayerConnector from={layers[0]} to={layers[1]} tags={["[0ms Optimistic]"]} />
          {card(layers[1])}
          <LayerConnector from={layers[1]} to={layers[2]} tags={["[postMessage]"]} />
          {card(layers[2])}
          <LayerConnector from={layers[2]} to={layers[3]} tags={["[IndexedDB Tx]"]} />
          {card(layers[3])}
          <p className="mt-3 text-xs text-neutral-500">
            Durable writes also flow State → Storage as batched <span className="font-mono">[IndexedDB Tx]</span> (write-behind),
            keeping light metadata separate from heavy binary data.
          </p>
        </section>

        <section aria-label="DevOps boundary" className="rounded-xl border-2 border-dashed border-neutral-300 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Workflow className="h-3.5 w-3.5" aria-hidden /> DevOps &amp; Production Hosting
          </p>
          <InfraCard icon={Workflow} title="GitHub Repository" detail={project.github_url || "No repository linked yet"} />
          <Wire tags={["[git push]"]} />
          <InfraCard icon={Rocket} title="CI/CD" detail="Build, test and deploy on every push to the main branch." />
          <Wire tags={["[HTTPS deploy]"]} />
          <InfraCard
            icon={Globe}
            title={`${host ?? "Production"} (production)`}
            detail={project.live_url || "No live URL yet. Add one in project settings."}
          />
          <Wire tags={["[HTTPS Ping]"]} up />
          <InfraCard icon={HeartPulse} title="Health Monitor" detail="Silph DevOps pings the production URL and records status and latency." />
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <span className="font-medium text-neutral-800">Delivery path</span>
        <span>{host ?? "Production host"}</span>
        <Tag>[HTTPS static assets]</Tag>
        <span>→ Service Worker precache →</span>
        <span className="font-medium">Layer 4 · offline cache</span>
      </div>
    </div>
  );
}

function RawSpec({ spec }: { spec: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the text stays selectable in the block below
    }
  };
  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <p className="text-xs text-neutral-500">Mermaid flowchart · paste into any Mermaid renderer or Markdown doc</p>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-neutral-800">
        <code>{spec}</code>
      </pre>
    </div>
  );
}

// Side inspector for the selected layer: what it is, its technologies and a runbook preview.
function LayerDetails({ layer, onOpenRunbook }: { layer: ArchitectureLayer; onOpenRunbook: (layer: ArchitectureLayer) => void }) {
  return (
    <aside aria-label="Technical details" className="h-fit rounded-xl border border-neutral-200 bg-white p-4 shadow-xs xl:sticky xl:top-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">{layer.tag}</p>
      <h2 className="mt-0.5 text-base font-semibold">{layer.title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{layer.summary}</p>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Technologies</h3>
      <Chips items={layer.tech} />
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Runbook preview</h3>
      <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-700">
        {layerRunbook(layer)}
      </pre>
      <button
        type="button"
        onClick={() => onOpenRunbook(layer)}
        className="mt-3 w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        Edit runbook &amp; linked tasks
      </button>
    </aside>
  );
}

export default function ProjectArchitecture({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const [mode, setMode] = useState<Mode>("visual");
  const [inspected, setInspected] = useState<ArchitectureLayer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLayers, setEditingLayers] = useState(false);
  // Bumped after the layers are edited so this render reads them again (the schematic and the Mermaid spec follow).
  const [, setVersion] = useState(0);
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  const base = `/projects/${project.id}`;
  const layers = architectureLayers(project);
  const selected = layers.find((l) => l.id === selectedId) ?? layers[0];
  // Selecting a layer also moves an open runbook to it, so the detail panel and the inspector never disagree.
  const selectLayer = (l: ArchitectureLayer) => {
    setSelectedId(l.id);
    setInspected((current) => (current ? l : null));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">System Architecture</h1>
          <p className="text-sm text-neutral-500">Select a layer to see its technical details · raw technical blueprint</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingLayers(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <Pencil className="h-4 w-4" aria-hidden /> Edit Layers
          </button>
          <div role="tablist" aria-label="Architecture view" className="flex rounded-md bg-neutral-100 p-0.5">
            {modes.map((m) => (
              <button
                key={m.value}
                role="tab"
                type="button"
                aria-selected={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`rounded px-3 py-1.5 text-sm ${mode === m.value ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mode === "visual" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Schematic project={project} layers={layers} selectedId={selected.id} onSelect={selectLayer} onInspect={setInspected} />
          <LayerDetails layer={selected} onOpenRunbook={setInspected} />
        </div>
      ) : (
        <RawSpec spec={mermaidSpec(project, layers)} />
      )}

      <ArchitectureLayersDialog
        open={editingLayers}
        onClose={() => setEditingLayers(false)}
        layers={layers}
        isCustom={hasCustomArchitectureLayers(project.id)}
        onSave={(next) => {
          saveCustomArchitectureLayers(project.id, next);
          setVersion((v) => v + 1);
        }}
        onReset={() => {
          resetCustomArchitectureLayers(project.id);
          setVersion((v) => v + 1);
        }}
      />

      {inspected && (
        <NodeInspector
          key={inspected.id}
          projectId={project.id}
          nodeId={`layer-${inspected.id}`}
          nodeTitle={inspected.title}
          nodeKind={inspected.tag}
          defaultNotes={layerRunbook(inspected)}
          onClose={() => setInspected(null)}
        />
      )}

      <p className="text-xs text-neutral-500">
        Technologies come from the stack in{" "}
        <Link href={`${base}/settings`} className="text-red-600 hover:underline">
          project settings
        </Link>
        . Edit it there to refine this blueprint.
      </p>

      <nav aria-label="Related sections" className="flex flex-wrap gap-3">
        <Link href={`${base}/diagrams`} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">
          📐 Open Flowchart / Diagrams
        </Link>
      </nav>
    </div>
  );
}
