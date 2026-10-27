import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkItem } from "./database.types";
import { ensureCloudProject } from "./cloud-projects";
import {
  addWorkItem,
  fetchCloudWorkItems,
  insertCloudWorkItem,
  loadWorkItems,
  mergeWorkItemRow,
  saveWorkItems,
  subscribeWorkItems,
  unsubscribeWorkItems,
  updateCloudWorkItem,
  updateWorkItem,
  type NewWorkItemInput,
  type StoredWorkItem,
} from "./work-items-storage";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

// One project's work items. With a workspaceId they live in Supabase (and stay live via Realtime);
// without one they live in localStorage. The source is fixed for the hook's lifetime, so callers
// remount it (key) when the workspace changes.
export function useWorkItems(projectId: string, workspaceId: string | null) {
  // null = the cloud fetch is still in flight.
  const [items, setItems] = useState<StoredWorkItem[] | null>(() => (workspaceId ? null : loadWorkItems(projectId)));
  const [error, setError] = useState<string | null>(null);
  const projectUuid = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId && items) saveWorkItems(projectId, items);
  }, [workspaceId, projectId, items]);

  const reload = useCallback(async () => {
    if (!projectUuid.current) return;
    try {
      setItems(await fetchCloudWorkItems(projectUuid.current));
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    let channel: ReturnType<typeof subscribeWorkItems> | null = null;
    (async () => {
      try {
        const pid = await ensureCloudProject(workspaceId, projectId);
        if (cancelled) return;
        projectUuid.current = pid;
        // Subscribe before fetching so nothing that happens during the fetch is missed.
        channel = subscribeWorkItems(pid, ({ type, row }) =>
          setItems((prev) => {
            if (!prev) return prev;
            if (type === "DELETE") return prev.filter((i) => i.id !== row.id);
            return mergeWorkItemRow(prev, row);
          })
        );
        const rows = await fetchCloudWorkItems(pid);
        if (!cancelled) setItems(rows);
      } catch (e) {
        if (!cancelled) {
          setError(messageOf(e));
          setItems((prev) => prev ?? []);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (channel) unsubscribeWorkItems(channel);
    };
  }, [workspaceId, projectId]);

  const add = (input: NewWorkItemInput) => {
    if (!workspaceId) {
      setItems((prev) => addWorkItem(prev ?? [], projectId, input));
      return;
    }
    const pid = projectUuid.current;
    if (!pid) return;
    insertCloudWorkItem(pid, input).then(
      (row: WorkItem) => {
        setError(null);
        setItems((prev) => mergeWorkItemRow(prev ?? [], row));
      },
      (e) => setError(messageOf(e))
    );
  };

  // Optimistic: the UI updates at once, and a failed write reloads the server's version.
  const update = (id: string, patch: Partial<WorkItem>) => {
    setItems((prev) => prev && updateWorkItem(prev, id, patch));
    if (!workspaceId) return;
    updateCloudWorkItem(id, patch).then(
      () => setError(null),
      (e) => {
        setError(messageOf(e));
        void reload();
      }
    );
  };

  const softDelete = (id: string) => update(id, { deleted_at: new Date().toISOString() });

  return { items, error, add, update, softDelete };
}
