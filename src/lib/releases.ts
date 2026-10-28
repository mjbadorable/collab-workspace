import { localDateIso, parseDescription, type WorkItemLabel } from "./checklist";
import type { ProjectRecord } from "./projects";
import { workItemKey, type StoredWorkItem } from "./work-items-storage";

export type ProjectRelease = {
  id: string;
  version: string;
  title: string;
  summary: string;
  publishedAt: string; // YYYY-MM-DD
  ticketKeys: string[];
};

const storageKey = (projectId: string) => `collab-workspace:releases:${projectId}`;

const range = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}-${from + i}`);

const release = (id: string, version: string, title: string, publishedAt: string, ticketKeys: string[], summary = ""): ProjectRelease => ({
  id,
  version,
  title,
  summary,
  publishedAt,
  ticketKeys,
});

function seedReleases(projectId: string): ProjectRelease[] {
  if (projectId === "collab-workspace") {
    return [
      release("seed-cw-1", "v1.0.0", "Core DevOps Control Plane & Kanban", "2026-10-25", range("CW", 1, 5), "Realtime Kanban, member permissions, GitHub activity, exports and repo import."),
      release("seed-cw-2", "v2.0.0", "Next-Gen Telemetry, Cycles, Team Room & Gamified Suite", "2026-10-28", range("CW", 6, 26), "Command palette, uptime telemetry, cycles and burndown, modules, Team Room, themes and more."),
    ];
  }
  if (projectId === "exam-reviewer-app") {
    return [
      release("seed-era-1", "v0.1.0", "Offline IndexedDB & Storage Guards", "2026-10-22", ["ERA-2"]),
      release("seed-era-2", "v0.2.0", "Split-Screen PDF Viewer & Bubble Sheet Engine", "2026-10-28", ["ERA-1"]),
    ];
  }
  if (projectId === "mastersoft-grade-encoding-assistant") {
    return [release("seed-mgea-1", "v1.0.0", "Production Offline PWA & Transmutation Calculator", "2026-10-20", ["MGEA-2", "MGEA-3", "MGEA-4"])];
  }
  return [];
}

// The saved list (seed releases included once one has been cut), else the project's built-in releases.
export function getReleases(projectId: string): ProjectRelease[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ProjectRelease[];
    }
  } catch {
    // corrupt JSON or storage blocked: fall back to the built-ins
  }
  return seedReleases(projectId);
}

export function createRelease(
  projectId: string,
  input: { version: string; title: string; summary: string; ticketKeys: string[] }
): ProjectRelease[] {
  const created: ProjectRelease = {
    id: crypto.randomUUID(),
    version: input.version.trim(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    publishedAt: localDateIso(),
    ticketKeys: input.ticketKeys,
  };
  const next = [...getReleases(projectId), created];
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    // storage blocked: the release lasts for this session only
  }
  return next;
}

const GROUPS: { label: WorkItemLabel | null; heading: string }[] = [
  { label: "Feature", heading: "🚀 Features" },
  { label: "Bug", heading: "🐛 Bug Fixes" },
  { label: "Architecture", heading: "🏛️ Architecture" },
  { label: "DevOps", heading: "🩺 DevOps" },
  { label: "UX", heading: "🎨 UX" },
  { label: null, heading: "📦 General" },
];

// Markdown release notes: the release's tickets grouped by label, with any linked commit or pull request.
export function buildReleaseMarkdown(project: ProjectRecord, rel: Pick<ProjectRelease, "version" | "title" | "summary" | "publishedAt" | "ticketKeys">, items: StoredWorkItem[]): string {
  const byKey = new Map(items.filter((i) => !i.deleted_at).map((i) => [workItemKey(project.id, i.seq), i] as const));
  const tickets = rel.ticketKeys.flatMap((key) => {
    const item = byKey.get(key);
    return item ? [{ key, item, parsed: parseDescription(item.description) }] : [];
  });

  const lines = [`# ${project.name} ${rel.version} — ${rel.title}`, "", `_Released ${rel.publishedAt}_`];
  if (rel.summary) lines.push("", rel.summary);

  for (const group of GROUPS) {
    const inGroup = tickets.filter((t) => t.parsed.label === group.label);
    if (inGroup.length === 0) continue;
    lines.push("", `## ${group.heading}`, "");
    for (const t of inGroup) {
      const links = [t.parsed.commit ? `(#${t.parsed.commit.slice(0, 7)})` : "", t.parsed.pr ? `(PR #${t.parsed.pr})` : ""].filter(Boolean);
      lines.push(`- **${t.key}**: ${t.item.title}${links.length ? ` ${links.join(" ")}` : ""}`);
    }
  }
  if (tickets.length === 0) lines.push("", "_No ticket details are available for this release._");
  return `${lines.join("\n")}\n`;
}
