"use client";

import type { ReactNode } from "react";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkItems } from "@/lib/use-work-items";

type Api = ReturnType<typeof useWorkItems>;

function Source({
  projectId,
  workspaceId,
  children,
}: {
  projectId: string;
  workspaceId: string | null;
  children: (api: Api) => ReactNode;
}) {
  const api = useWorkItems(projectId, workspaceId);
  return <>{children(api)}</>;
}

// Like LiveWorkItems, but hands its render prop the whole hook (items plus add / update) so views can edit.
export default function WorkItemsSource({
  projectId,
  children,
  fallback,
}: {
  projectId: string;
  children: (api: Api) => ReactNode;
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
