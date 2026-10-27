"use client";

import type { ReactNode } from "react";
import { SEED_PROJECT } from "@/lib/projects";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import type { StoredWorkItem } from "@/lib/work-items-storage";

function Source({
  projectId,
  workspaceId,
  children,
}: {
  projectId: string;
  workspaceId: string | null;
  children: (items: StoredWorkItem[] | null, error: string | null) => ReactNode;
}) {
  const { items, error } = useWorkItems(projectId, workspaceId);
  return <>{children(items ? items.filter((i) => !i.deleted_at) : null, error)}</>;
}

// Feeds a project's live (non-deleted) work items (the main project by default) to its render prop:
// from Supabase when signed in, from localStorage otherwise. `items` is null until they are available.
export default function LiveWorkItems({
  projectId = SEED_PROJECT.id,
  children,
  fallback,
}: {
  projectId?: string;
  children: (items: StoredWorkItem[] | null, error: string | null) => ReactNode;
  fallback: ReactNode;
}) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <>{fallback}</>;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source or project changes (sign-in, sign-out, workspace switch).
  return (
    <Source key={`${workspaceId ?? "local"}:${projectId}`} projectId={projectId} workspaceId={workspaceId}>
      {children}
    </Source>
  );
}
