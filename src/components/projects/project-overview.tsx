"use client";

import Link from "next/link";
import { ArrowRight, Circle, Diamond, ExternalLink, GitFork, Square, type LucideIcon } from "lucide-react";
import HealthPill from "@/components/home/health-pill";
import LiveWorkItems from "@/components/home/live-work-items";
import { progressOf } from "@/components/home/project-card";
import GithubActivity from "@/components/projects/github-activity";
import { getFlow } from "@/lib/diagram-storage";
import { techRows } from "@/lib/project-stack";
import { getProjectDiagrams, type ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";

export function ProjectAvatar({ project, className = "h-12 w-12 text-xl" }: { project: ProjectRecord; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-red-500 to-amber-400 font-semibold text-white ${className}`}
    >
      {project.icon ?? project.name[0]?.toUpperCase()}
    </span>
  );
}

export function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">Project not found</h1>
      <p className="mt-1 text-sm text-neutral-500">It may have been deleted, or it lives in another workspace.</p>
      <Link href="/projects" className="mt-4 inline-block text-sm text-red-600 hover:underline">
        Back to Projects
      </Link>
    </div>
  );
}

function SectionCard({
  emoji,
  title,
  href,
  action,
  children,
}: {
  emoji: string;
  title: string;
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{emoji}</span> {title}
      </h3>
      <div className="mt-3 flex-1 text-sm text-neutral-600">{children}</div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
        {action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

const stepIcons: Record<string, { icon: LucideIcon; label: string }> = {
  terminal: { icon: Circle, label: "Start / End" },
  process: { icon: Square, label: "Process" },
  decision: { icon: Diamond, label: "Decision" },
};

const stepTone = (type: string | undefined) =>
  type === "decision"
    ? "border-amber-300 bg-amber-50 text-amber-600"
    : type === "terminal"
      ? "border-neutral-300 bg-neutral-100 text-neutral-700"
      : "border-red-200 bg-red-50 text-red-600";

// The project's User Flow as a left-to-right pipeline of numbered steps (System and Backend flows are on the canvas page).
function FlowchartPipeline({ projectId }: { projectId: string }) {
  const steps = getFlow(projectId, "user").steps;

  return (
    <section aria-labelledby="ov-flow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ov-flow" className="text-sm font-semibold text-neutral-700">
          Process Flowchart
        </h2>
        <Link
          href={`/projects/${projectId}/diagrams?category=user`}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Open Full Flowchart Canvas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ol className="mt-3 flex items-stretch overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        {steps.map((step, i) => {
          const kind = stepIcons[step.kind];
          const Icon = kind.icon;
          return (
            <li key={step.id} className="flex shrink-0 items-center">
              <div className="flex w-40 flex-col items-center gap-2 text-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-md border ${stepTone(step.kind)}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{kind.label}</span>
                </span>
                <span className="text-xs font-medium leading-snug text-neutral-800">{step.label}</span>
              </div>
              {i < steps.length - 1 && <ArrowRight className="mx-1 h-4 w-4 shrink-0 text-neutral-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  const base = `/projects/${project.id}`;
  const diagrams = getProjectDiagrams(project.id);
  const linkClass =
    "flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-start gap-4">
        <ProjectAvatar project={project} className="h-14 w-14 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
              {project.identifier}
            </span>
          </div>
          {project.live_url ? (
            <div className="mt-2">
              <HealthPill url={project.live_url} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              No live URL yet. Add one in{" "}
              <Link href={`${base}/settings`} className="text-red-600 hover:underline">
                settings
              </Link>{" "}
              to monitor production.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {project.github_url && (
            <a href={project.github_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <GitFork className="h-3.5 w-3.5" aria-hidden /> GitHub
            </a>
          )}
          {project.live_url && (
            <a href={project.live_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Live App
            </a>
          )}
        </div>
      </header>

      <section aria-labelledby="ov-about" className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="ov-about" className="text-sm font-semibold text-neutral-700">
            What it is
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {project.description || "No description yet. Add one in project settings."}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Core functions</h2>
          {project.functions.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 marker:text-red-500">
              {project.functions.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">No functions listed yet. Add them in project settings.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="ov-stack">
        <h2 id="ov-stack" className="text-sm font-semibold text-neutral-700">
          Tech stack
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Layer</th>
                <th className="px-4 py-2 font-medium">Technologies Used</th>
                <th className="px-4 py-2 font-medium">Responsibilities / Architecture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {techRows(project).map((row) => (
                <tr key={row.layer} className="align-top">
                  <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">
                    {row.layer}
                  </th>
                  <td className="px-4 py-3 text-neutral-700">{row.tech}</td>
                  <td className="px-4 py-3 text-neutral-500">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GithubActivity githubUrl={project.github_url} />

      <FlowchartPipeline key={project.id} projectId={project.id} />

      <section aria-label="Project sections" className="grid gap-4 sm:grid-cols-3">
        <SectionCard emoji="📋" title="Work Items" href={`${base}/work-items`} action="Open Kanban Board">
          <LiveWorkItems projectId={project.id} fallback={<div className="h-12" />}>
            {(items) => {
              const { total, done, percent } = progressOf(items);
              const active = items ? total - done : 0;
              return (
                <>
                  <p>
                    <span className="text-2xl font-semibold text-neutral-900">{items ? active : "–"}</span> active
                    {items && <span className="text-neutral-500"> · {done}/{total} done</span>}
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Work item progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
                  >
                    <div className="h-full rounded-full bg-linear-to-r from-red-500 to-amber-400" style={{ width: `${percent}%` }} />
                  </div>
                </>
              );
            }}
          </LiveWorkItems>
        </SectionCard>

        <SectionCard emoji="🏛️" title="System Architecture" href={`${base}/architecture`} action="View Architecture">
          <p>Four decoupled layers: UI, application state, workers and engine, and storage with offline cache.</p>
        </SectionCard>

        <SectionCard emoji="📐" title="Flowchart / Diagrams" href={`${base}/diagrams?category=user`} action="Open Flowchart">
          <p>
            <span className="text-2xl font-semibold text-neutral-900">{diagrams.length}</span>{" "}
            process flows
          </p>
          <p className="mt-1 text-neutral-500">{diagrams.map((d) => d.name).join(", ")}</p>
        </SectionCard>
      </section>
    </div>
  );
}
