"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { dueBadge, localDateIso, parseDescription } from "@/lib/checklist";
import { mockUser, mockWorkspace } from "@/lib/mock-data";
import { downloadFile } from "@/lib/project-report";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import type { ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { loadWorkItems, workItemKey, type StoredWorkItem } from "@/lib/work-items-storage";

type HealthResult = { state: "ok"; status: number; latencyMs: number } | { state: "down" };

type Line = { key: string; title: string; note?: string };
type Group = { project: ProjectRecord; lines: Line[] };

type Standup = {
  date: string;
  workspace: string;
  fleet: { project: ProjectRecord; health: HealthResult | undefined }[];
  shipped: Group[];
  inProgress: Group[];
  attention: { project: ProjectRecord; key: string; title: string; reason: string }[];
  shippedIsRecent: boolean; // false when nothing finished in the last 48h and the newest completed items are shown
};

const RECENT_DAYS = 2;
const FALLBACK_SHIPPED = 5;

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateIso(d);
}

function compile(
  projects: ProjectRecord[],
  boards: Map<string, StoredWorkItem[]>,
  health: Map<string, HealthResult>,
  workspace: string,
  assigneeName: (id: string | null) => string
): Standup {
  const since = daysAgoIso(RECENT_DAYS);
  const shipped: Group[] = [];
  const inProgress: Group[] = [];
  const attention: Standup["attention"] = [];

  const finished = projects.map((project) => {
    const items = (boards.get(project.id) ?? []).filter((i) => !i.deleted_at);
    return {
      project,
      done: items
        .filter((i) => i.status === "done")
        .map((item) => ({ item, on: parseDescription(item.description).completedDate ?? item.created_at.slice(0, 10) })),
    };
  });
  const recentFound = finished.some((f) => f.done.some((d) => d.on >= since));

  for (const { project, done } of finished) {
    const chosen = recentFound ? done.filter((d) => d.on >= since) : done.sort((a, b) => b.on.localeCompare(a.on)).slice(0, FALLBACK_SHIPPED);
    if (chosen.length > 0) {
      shipped.push({ project, lines: chosen.map((d) => ({ key: workItemKey(project.id, d.item.seq), title: d.item.title, note: d.on })) });
    }
  }

  for (const project of projects) {
    const items = (boards.get(project.id) ?? []).filter((i) => !i.deleted_at);
    const statusByKey = new Map(items.map((i) => [workItemKey(project.id, i.seq), i.status] as const));
    const lines: Line[] = [];
    for (const item of items.sort((a, b) => a.seq - b.seq)) {
      const key = workItemKey(project.id, item.seq);
      const p = parseDescription(item.description);
      if (item.status === "in_progress") {
        const bits = [assigneeName(item.assignee_id), `${item.priority} priority`, p.cycle ? `cycle: ${p.cycle}` : ""].filter(Boolean);
        lines.push({ key, title: item.title, note: bits.join(" · ") });
      }
      if (item.status !== "done") {
        if (p.blockedBy && statusByKey.get(p.blockedBy) !== "done") {
          attention.push({ project, key, title: item.title, reason: `blocked by ${p.blockedBy}` });
        }
        const due = dueBadge(p.dueDate, item.status);
        if (due && (due.text.startsWith("Overdue") || due.text.startsWith("Due soon"))) {
          attention.push({ project, key, title: item.title, reason: due.text.toLowerCase() });
        }
      }
    }
    if (lines.length > 0) inProgress.push({ project, lines });
  }

  return {
    date: localDateIso(),
    workspace,
    fleet: projects.map((project) => ({ project, health: project.live_url ? health.get(project.live_url) : undefined })),
    shipped,
    inProgress,
    attention,
    shippedIsRecent: recentFound,
  };
}

const healthText = (project: ProjectRecord, h: HealthResult | undefined) =>
  !project.live_url ? "No live URL" : !h ? "Checking…" : h.state === "ok" ? `${h.status} OK` : "Unreachable";
const latencyText = (h: HealthResult | undefined) => (h?.state === "ok" ? `${h.latencyMs}ms` : "–");

function toMarkdown(s: Standup): string {
  const lines = [`# Daily Standup — ${s.date}`, "", `**Workspace:** ${s.workspace}`, "", "## 🩺 Fleet Health Status", ""];
  lines.push("| Project | Live URL | Status | Latency |", "|---|---|---|---|");
  for (const f of s.fleet) {
    lines.push(`| ${f.project.name} | ${f.project.live_url || "–"} | ${healthText(f.project, f.health)} | ${latencyText(f.health)} |`);
  }

  lines.push("", `## ✅ ${s.shippedIsRecent ? "Recently Shipped (last 48h)" : "Recently Completed"}`);
  if (s.shipped.length === 0) lines.push("", "_Nothing completed yet._");
  for (const g of s.shipped) {
    lines.push("", `### ${g.project.name}`, ...g.lines.map((l) => `- **${l.key}**: ${l.title}${l.note ? ` _(${l.note})_` : ""}`));
  }

  lines.push("", "## 🎯 In Progress Today");
  if (s.inProgress.length === 0) lines.push("", "_Nothing in progress._");
  for (const g of s.inProgress) {
    lines.push("", `### ${g.project.name}`, ...g.lines.map((l) => `- **${l.key}**: ${l.title}${l.note ? ` — ${l.note}` : ""}`));
  }

  lines.push("", "## ⛔ Blockers & Due Soon");
  if (s.attention.length === 0) lines.push("", "_No blockers or approaching deadlines._");
  else lines.push("", ...s.attention.map((a) => `- **${a.key}** (${a.project.name}): ${a.title} — ${a.reason}`));
  return `${lines.join("\n")}\n`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function GroupList({ groups, empty }: { groups: Group[]; empty: string }) {
  if (groups.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.project.id}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{g.project.name}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {g.lines.map((l) => (
              <li key={l.key} className="flex flex-wrap gap-x-2">
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 font-mono text-xs leading-5 text-neutral-600">{l.key}</span>
                <span className="min-w-0 flex-1">{l.title}</span>
                {l.note && <span className="text-xs text-neutral-500">{l.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StandupBody({ onClose }: { onClose: () => void }) {
  const { projects } = useProjects();
  const { current } = useWorkspaces();
  const { user } = useAuth();
  const { displayName } = useProfile();
  const [health, setHealth] = useState<Map<string, HealthResult>>(new Map());
  const [copied, setCopied] = useState(false);

  // Check every live URL once, as the dialog opens.
  useEffect(() => {
    const controller = new AbortController();
    for (const url of new Set(projects.map((p) => p.live_url).filter(Boolean))) {
      fetch(`/api/health-check?url=${encodeURIComponent(url)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { ok: boolean; status: number; latencyMs: number }) => {
          const result: HealthResult = d.ok ? { state: "ok", status: d.status, latencyMs: d.latencyMs } : { state: "down" };
          setHealth((prev) => new Map(prev).set(url, result));
        })
        .catch(() => {
          if (!controller.signal.aborted) setHealth((prev) => new Map(prev).set(url, { state: "down" }));
        });
    }
    return () => controller.abort();
  }, [projects]);

  // Each project's local board (the cloud copy is mirrored there once the project has been opened).
  const boards = useMemo(() => new Map(projects.map((p) => [p.id, loadWorkItems(p.id)] as const)), [projects]);
  const meId = user?.id ?? mockUser.id;
  const standup = useMemo(
    () =>
      compile(projects, boards, health, current?.name ?? mockWorkspace.name, (id) =>
        id === null ? "Unassigned" : id === meId ? displayName : "Teammate"
      ),
    [projects, boards, health, current, meId, displayName]
  );
  const markdown = useMemo(() => toMarkdown(standup), [standup]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: Download .md still works
    }
  };

  return (
    <div className="flex max-h-[88vh] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-5 py-3">
        <h2 className="flex-1 text-base font-semibold">📋 Daily Standup Digest</h2>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copied!" : "Copy Markdown"}
        </button>
        <button
          type="button"
          onClick={() => downloadFile(`standup-${standup.date}.md`, markdown, "text/markdown;charset=utf-8")}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <Download className="h-4 w-4" aria-hidden /> Download .md
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="overflow-y-auto px-5 pb-5">
        <h3 className="mt-4 text-lg font-semibold">Daily Standup — {standup.date}</h3>
        <p className="text-sm text-neutral-500">Workspace: {standup.workspace}</p>

        <Section title="🩺 Fleet Health Status">
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Project</th>
                  <th className="px-3 py-1.5 font-medium">Live URL</th>
                  <th className="px-3 py-1.5 font-medium">Status</th>
                  <th className="px-3 py-1.5 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {standup.fleet.map((f) => (
                  <tr key={f.project.id}>
                    <td className="px-3 py-1.5 font-medium">{f.project.name}</td>
                    <td className="max-w-48 truncate px-3 py-1.5 text-neutral-500" title={f.project.live_url}>{f.project.live_url || "–"}</td>
                    <td className={`px-3 py-1.5 ${f.health?.state === "down" ? "text-red-600" : f.health?.state === "ok" ? "text-emerald-700" : "text-neutral-500"}`}>
                      {healthText(f.project, f.health)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-neutral-500">{latencyText(f.health)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={standup.shippedIsRecent ? "✅ Recently Shipped (last 48h)" : "✅ Recently Completed"}>
          <GroupList groups={standup.shipped} empty="Nothing completed yet." />
        </Section>

        <Section title="🎯 In Progress Today">
          <GroupList groups={standup.inProgress} empty="Nothing in progress." />
        </Section>

        <Section title="⛔ Blockers & Due Soon">
          {standup.attention.length === 0 ? (
            <p className="text-sm text-neutral-500">No blockers or approaching deadlines.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {standup.attention.map((a) => (
                <li key={`${a.key}-${a.reason}`} className="flex flex-wrap gap-x-2">
                  <span className="shrink-0 rounded bg-neutral-100 px-1.5 font-mono text-xs leading-5 text-neutral-600">{a.key}</span>
                  <span className="min-w-0 flex-1">{a.title}</span>
                  <span className="text-xs font-medium text-red-600">{a.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

// Everything worth saying at a standup, across all projects, as a preview and as Markdown to paste or download.
export default function StandupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Daily standup digest"
      className="m-auto w-full max-w-2xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounting the body only while open re-reads the boards and re-checks health each time. */}
      {open && <StandupBody onClose={onClose} />}
    </dialog>
  );
}
