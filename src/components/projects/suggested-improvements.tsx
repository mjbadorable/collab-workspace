"use client";

import { Check, Plus } from "lucide-react";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import type { WorkItemPriority, WorkItemStatus } from "@/lib/work-items-storage";

// The titles match the CW-6..CW-9 seed items, so a suggestion shows its status once it is on the board.
const SUGGESTIONS: { heading: string; title: string; blurb: string; priority: WorkItemPriority }[] = [
  {
    heading: "Command Palette (Ctrl+K)",
    title: "Command Palette (Ctrl+K / Cmd+K) for instant project, ticket, and diagram navigation",
    blurb: "Jump to any project, work item or flow from the keyboard.",
    priority: "high",
  },
  {
    heading: "Uptime Sparklines & Alerts",
    title: "Automated Uptime History Sparkline & Webhook Alerts (Discord/Slack) on health check failure",
    blurb: "Chart recent health checks and get pinged the moment production goes down.",
    priority: "high",
  },
  {
    heading: "Vercel Deployment & PR Stream",
    title: "GitHub PR & Deployment Environment Statuses (Vercel preview links) in Commit Stream",
    blurb: "See open pull requests and preview deployments next to the commit stream.",
    priority: "medium",
  },
  {
    heading: "Rich Ticket Checklists & Due Dates",
    title: "Kanban Keyboard Shortcuts, Due Dates, and Sub-task Checklists on Work Items",
    blurb: "Shortcuts, due dates and sub-task checklists for finer-grained planning.",
    priority: "medium",
  },
];

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };

function Suggestions({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const { items, add } = useWorkItems(projectId, workspaceId);

  return (
    <section aria-labelledby="ov-suggest">
      <h2 id="ov-suggest" className="text-sm font-semibold text-neutral-700">
        Suggested Workspace Improvements
      </h2>
      <p className="mt-1 text-xs text-neutral-500">High-impact next steps for the Next-Gen roadmap.</p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => {
          const onBoard = items?.find((i) => !i.deleted_at && i.title === s.title);
          return (
            <li key={s.title} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
              <h3 className="text-sm font-semibold">{s.heading}</h3>
              <p className="mt-1 flex-1 text-sm text-neutral-500">{s.blurb}</p>
              <div className="mt-3">
                {items === null ? (
                  <span className="text-xs text-neutral-400">Checking the board…</span>
                ) : onBoard ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <Check className="h-3 w-3" aria-hidden /> On the board · {STATUS_LABEL[onBoard.status]}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => add({ title: s.title, description: s.blurb, status: "backlog", priority: s.priority })}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    <Plus className="h-3 w-3" aria-hidden /> Add to Backlog
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SuggestedImprovements({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return null;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return <Suggestions key={workspaceId ?? "local"} projectId={projectId} workspaceId={workspaceId} />;
}
