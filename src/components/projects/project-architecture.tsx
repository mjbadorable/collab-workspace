"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, Globe, HeartPulse, Rocket, Workflow } from "lucide-react";
import { architectureLayers, hostingOf, type ArchitectureLayer } from "@/lib/project-stack";
import type { ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";
import { ProjectAvatar, ProjectNotFound } from "./project-overview";

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

function LayerCard({ layer }: { layer: ArchitectureLayer }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">{layer.tag}</p>
      <h3 className="text-sm font-semibold">{layer.title}</h3>
      <p className="mt-0.5 text-xs text-neutral-500">{layer.summary}</p>
      <Chips items={layer.tech} />
    </div>
  );
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

function Schematic({ project, layers }: { project: ProjectRecord; layers: ArchitectureLayer[] }) {
  const host = hostingOf(project.live_url);
  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-label="Client-side boundary" className="rounded-xl border-2 border-dashed border-neutral-300 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Globe className="h-3.5 w-3.5" aria-hidden /> Browser · client-side, offline-first boundary
          </p>
          <LayerCard layer={layers[0]} />
          <Wire tags={["[0ms Optimistic]"]} />
          <LayerCard layer={layers[1]} />
          <Wire tags={["[postMessage]"]} />
          <LayerCard layer={layers[2]} />
          <Wire tags={["[IndexedDB Tx]"]} />
          <LayerCard layer={layers[3]} />
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

export default function ProjectArchitecture({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const [mode, setMode] = useState<Mode>("visual");
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  const base = `/projects/${project.id}`;
  const layers = architectureLayers(project);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ProjectAvatar project={project} className="h-10 w-10 text-lg" />
          <div>
            <h1 className="text-xl font-semibold">System Architecture</h1>
            <p className="text-sm text-neutral-500">
              <Link href={base} className="hover:text-neutral-900">
                {project.name}
              </Link>{" "}
              · raw technical blueprint
            </p>
          </div>
        </div>
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
      </header>

      {mode === "visual" ? <Schematic project={project} layers={layers} /> : <RawSpec spec={mermaidSpec(project, layers)} />}

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
