"use client";

import { Check, Plus } from "lucide-react";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import { seedItems, type WorkItemStatus } from "@/lib/work-items-storage";

// The workspace roadmap, CW-1..CW-15. It reads the same seed list the board starts from, so a card shows its
// real status once it is on the board and offers "Add to Backlog" if it is not.
const ROADMAP = seedItems("collab-workspace").map((s) => ({ key: `CW-${s.seq}`, title: s.title, priority: s.priority }));

const STATUS_LABEL: Record<WorkItemStatus, string> = { backlog: "Backlog", in_progress: "In Progress", done: "Done" };

function Suggestions({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const { items, add } = useWorkItems(projectId, workspaceId);

  return (
    <section aria-labelledby="ov-suggest">
      <h2 id="ov-suggest" className="text-sm font-semibold text-neutral-700">
        Workspace Roadmap · CW-1 to CW-{ROADMAP.length}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">Milestones for the Next-Gen workspace, with their live status from the board.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROADMAP.map((r) => {
          const onBoard = items?.find((i) => !i.deleted_at && i.title === r.title);
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
