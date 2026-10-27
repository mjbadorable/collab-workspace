"use client";

import type { ReactNode } from "react";
import { mockProjects } from "@/lib/mock-data";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";
import type { StoredWorkItem } from "@/lib/work-items-storage";

function Source({
  workspaceId,
  children,
}: {
  workspaceId: string | null;
  children: (items: StoredWorkItem[] | null, error: string | null) => ReactNode;
}) {
  const { items, error } = useWorkItems(mockProjects[0].id, workspaceId);
  return <>{children(items ? items.filter((i) => !i.deleted_at) : null, error)}</>;
}

// Feeds the live (non-deleted) work items of the main project to its render prop: from Supabase when
// signed in, from localStorage otherwise. `items` is null until they are available.
export default function LiveWorkItems({
  children,
  fallback,
}: {
  children: (items: StoredWorkItem[] | null, error: string | null) => ReactNode;
  fallback: ReactNode;
}) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <>{fallback}</>;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return (
    <Source key={workspaceId ?? "local"} workspaceId={workspaceId}>
      {children}
    </Source>
  );
}
