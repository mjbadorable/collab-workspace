"use client";

import { useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import { canonicalSeedTitle, seedItems, type StoredWorkItem, type WorkItemStatus } from "@/lib/work-items-storage";

// The workspace roadmap, every CW seed. It reads the same seed list the board starts from, so a card shows its
// real status once it is on the board and offers "Add to Backlog" if it is not.
const ROADMAP = seedItems("collab-workspace").map((s) => ({ key: `CW-${s.seq}`, title: s.title, priority: s.priority }));
const SEED_TITLES = new Set(ROADMAP.map((r) => r.title));

// The board item standing for a milestone: its exact title, an older wording of it, or a title that starts with
// its CW key ("CW-41 live git monitor"). The sequence number alone is not used: the board gives a new ticket the
// next free number, so a ticket of your own can hold seq 43 without being the CW-43 milestone.
function findOnBoard(items: StoredWorkItem[], r: (typeof ROADMAP)[number]): StoredWorkItem | undefined {
  const live = items.filter((i) => !i.deleted_at);
  return (
    live.find((i) => i.title === r.title) ??
    live.find((i) => canonicalSeedTitle(i.title, SEED_TITLES) === r.title) ??
    live.find((i) => new RegExp(`^${r.key}(?![0-9])`, "i").test(i.title.trim()))
  );
}

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };

function Suggestions({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const { items, add } = useWorkItems(projectId, workspaceId);
  const [expanded, setExpanded] = useState(false);

  const matched = items ? ROADMAP.map((r) => findOnBoard(items, r)) : null;
  const doneCount = matched ? matched.filter((m) => m?.status === "done").length : null;
  const missing = matched ? ROADMAP.filter((_, n) => !matched[n]) : [];

  // Repairs the board in one click: every milestone it lacks is added as done (they are shipped work).
  const syncSeeds = () => {
    for (const r of missing) add({ title: r.title, description: "", status: "done", priority: r.priority });
  };
  // Newest milestones first; collapsed, only the six most recent.
  const shown = expanded ? [...ROADMAP].reverse() : ROADMAP.slice(-6).reverse();

  return (
    <section aria-labelledby="ov-suggest">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ov-suggest" className="text-sm font-semibold text-neutral-700">
          Workspace Roadmap · CW-1 to CW-{ROADMAP.length}
        </h2>
        <div className="flex items-center gap-2">
          {missing.length > 0 && (
            <button
              type="button"
              onClick={syncSeeds}
              title={`${missing.length} milestones are not on this board yet`}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Sync {ROADMAP.length} Seeds
            </button>
          )}
          {doneCount !== null && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              {doneCount} / {ROADMAP.length} completed
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">Milestones for the Next-Gen workspace, with their live status from the board.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => {
          const onBoard = items ? findOnBoard(items, r) : undefined;
          return (
            <li key={r.key} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
              <span className="w-fit rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{r.key}</span>
              <h3 className="mt-2 flex-1 text-sm font-medium leading-snug">{r.title}</h3>
              <div className="mt-3">
                {items === null ? (
                  <span className="text-xs text-neutral-400">Checking the board…</span>
                ) : onBoard ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      onBoard.status === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <Check className="h-3 w-3" aria-hidden /> {STATUS_LABEL[onBoard.status]}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => add({ title: r.title, description: "", status: "backlog", priority: r.priority })}
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
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 block rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        {expanded ? "Show fewer milestones" : `Show all ${ROADMAP.length} milestones`}
      </button>
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
