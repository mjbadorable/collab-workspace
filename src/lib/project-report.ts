import { getFlow, getMermaidForCategory, type FlowCategory } from "./diagram-storage";
import type { ProjectRecord } from "./projects";
import { techRows, type TechRow } from "./project-stack";
import { workItemKey, type StoredWorkItem, type WorkItemStatus } from "./work-items-storage";

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };
const FLOW_CATEGORIES: FlowCategory[] = ["user", "system", "backend"];

export type ReportTicket = {
  key: string;
  title: string;
  status: WorkItemStatus;
  statusLabel: string;
  priority: StoredWorkItem["priority"];
  description: string | null;
};

export type ReportFlow = {
  category: FlowCategory;
  title: string;
  summary: string;
  steps: { label: string; kind: string }[];
  mermaid: string;
};

// Everything a report says, gathered once so the preview, Markdown and JSON can never disagree.
export type ProjectReport = {
  generatedAt: string;
  project: Pick<ProjectRecord, "id" | "name" | "identifier" | "description" | "github_url" | "live_url" | "functions">;
  health: string | null;
  techStack: TechRow[];
  progress: { total: number; backlog: number; inProgress: number; done: number; active: number; percent: number };
  tickets: ReportTicket[];
  flows: ReportFlow[];
};

export function buildReport(project: ProjectRecord, items: StoredWorkItem[], healthStatus: string | null): ProjectReport {
  const live = items.filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);
  const count = (s: WorkItemStatus) => live.filter((i) => i.status === s).length;
  const done = count("done");

  return {
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      description: project.description,
      github_url: project.github_url,
      live_url: project.live_url,
      functions: project.functions,
    },
    health: healthStatus,
    techStack: techRows(project),
    progress: {
      total: live.length,
      backlog: count("backlog"),
      inProgress: count("in_progress"),
      done,
      active: live.length - done,
      percent: live.length ? Math.round((done / live.length) * 100) : 0,
    },
    tickets: live.map((i) => ({
      key: workItemKey(project.id, i.seq),
      title: i.title,
      status: i.status,
      statusLabel: STATUS_LABEL[i.status],
      priority: i.priority,
      description: i.description,
    })),
    flows: FLOW_CATEGORIES.map((category) => {
      const flow = getFlow(project.id, category);
      return {
        category,
        title: flow.title,
        summary: flow.summary,
        steps: flow.steps.map((s) => ({ label: s.label, kind: s.kind })),
        mermaid: getMermaidForCategory(project.id, category),
      };
    }),
  };
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export const reportDate = (report: ProjectReport) => report.generatedAt.slice(0, 10);

export function markdownFromReport(r: ProjectReport): string {
  const { project, progress } = r;
  const lines: string[] = [
    `# ${project.name} — Project Report`,
    "",
    `- **Identifier:** ${project.identifier}`,
    `- **Generated:** ${reportDate(r)}`,
    `- **Live telemetry:** ${r.health ?? "No live URL set"}`,
    ...(project.live_url ? [`- **Production URL:** ${project.live_url}`] : []),
    ...(project.github_url ? [`- **Repository:** ${project.github_url}`] : []),
    "",
    "## What it is",
    "",
    project.description || "_No description yet._",
    "",
    "## Core functions",
    "",
    ...(project.functions.length ? project.functions.map((f) => `- ${f}`) : ["_No functions listed yet._"]),
    "",
    "## Tech stack",
    "",
    "| Layer | Technologies Used | Responsibilities / Architecture |",
    "|---|---|---|",
    ...r.techStack.map((t) => `| ${cell(t.layer)} | ${cell(t.tech)} | ${cell(t.role)} |`),
    "",
    "## Sprint & work items progress",
    "",
    `**${progress.percent}% complete** — ${progress.done} done, ${progress.active} active (${progress.inProgress} in progress, ${progress.backlog} backlog) of ${progress.total} work items.`,
    "",
    ...(r.tickets.length
      ? [
          "| Key | Title | Status | Priority |",
          "|---|---|---|---|",
          ...r.tickets.map((t) => `| ${t.key} | ${cell(t.title)} | ${t.statusLabel} | ${t.priority} |`),
        ]
      : ["_No work items yet._"]),
    "",
    "## Process flows",
  ];

  for (const flow of r.flows) {
    lines.push("", `### ${flow.title}`, "", flow.summary, "", "```mermaid", flow.mermaid, "```");
  }
  return `${lines.join("\n")}\n`;
}

export function generateMarkdownReport(project: ProjectRecord, items: StoredWorkItem[], healthStatus: string | null): string {
  return markdownFromReport(buildReport(project, items, healthStatus));
}

export function generateJsonReport(project: ProjectRecord, items: StoredWorkItem[], healthStatus: string | null): string {
  return JSON.stringify(jsonFromReport(buildReport(project, items, healthStatus)), null, 2);
}

export function jsonFromReport(r: ProjectReport) {
  return {
    generatedAt: r.generatedAt,
    project: r.project,
    telemetry: { health: r.health },
    techStack: r.techStack,
    workItems: { summary: r.progress, items: r.tickets },
    processFlows: r.flows,
  };
}

// Triggers a download with a temporary object URL: no libraries, works in all major browsers.
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: some browsers cancel the download if the URL disappears immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
