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
  seedItems,
  subscribeLocalWorkItems,
  subscribeWorkItems,
  unsubscribeWorkItems,
  updateCloudWorkItem,
  updateWorkItem,
  type NewWorkItemInput,
  type RealtimeStatus,
  type StoredWorkItem,
  type Viewer,
} from "./work-items-storage";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

const FLASH_MS = 2200;

const sameContent = (a: StoredWorkItem, b: WorkItem) =>
  a.title === b.title &&
  a.description === b.description &&
  a.status === b.status &&
  a.priority === b.priority &&
  a.assignee_id === b.assignee_id &&
  a.deleted_at === b.deleted_at;

// A cloud project with no work items gets the project's built-in seed items, once per project (guarded in
// localStorage so deleting them later does not bring them back). Returns the rows to show.
async function seedEmptyCloudProject(
  projectUuid: string,
  projectId: string,
  current: StoredWorkItem[],
  isCancelled: () => boolean
): Promise<StoredWorkItem[]> {
  const seeds = seedItems(projectId);
  if (seeds.length === 0) return current;
  const guard = `collab-workspace:cloud-seeded:${projectUuid}`;
  try {
    if (localStorage.getItem(guard)) return current;
    localStorage.setItem(guard, "1");
  } catch {
    return current; // without storage the guard cannot hold, so do not risk seeding on every visit
  }
  // In order, so created_at (and therefore the CW-1.. numbering) follows the seed order. Seed assignees are mock ids.
  for (const s of seeds) {
    if (isCancelled()) return current;
    await insertCloudWorkItem(projectUuid, {
      title: s.title,
      description: s.description ?? "",
      status: s.status,
      priority: s.priority,
    });
  }
  return fetchCloudWorkItems(projectUuid);
}

// One project's work items. With a workspaceId they live in Supabase (and stay live via Realtime, with presence);
// without one they live in localStorage and sync across tabs. The source is fixed for the hook's lifetime, so
// callers remount it (key) when the workspace changes.
export function useWorkItems(projectId: string, workspaceId: string | null, viewer: Viewer | null = null) {
  // null = the cloud fetch is still in flight.
  const [items, setItems] = useState<StoredWorkItem[] | null>(() => (workspaceId ? null : loadWorkItems(projectId)));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>(workspaceId ? "connecting" : "offline");
  const [activeUsers, setActiveUsers] = useState<Viewer[]>([]);
  // Ids of items another user just changed; they clear themselves after FLASH_MS.
  const [remoteUpdatedIds, setRemoteUpdatedIds] = useState<ReadonlySet<string>>(new Set());
  const projectUuid = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const viewerRef = useRef(viewer);
  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    itemsRef.current = items;
    viewerRef.current = viewer;
  });

  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRemoteUpdatedIds((prev) => new Set([...prev, ...ids]));
    for (const id of ids) {
      clearTimeout(flashTimers.current.get(id));
      flashTimers.current.set(
        id,
        setTimeout(() => {
          flashTimers.current.delete(id);
          setRemoteUpdatedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, FLASH_MS)
      );
    }
  }, []);

  useEffect(() => {
    if (!workspaceId && items) saveWorkItems(projectId, items);
  }, [workspaceId, projectId, items]);

  // Local preview: another tab saved this project's items.
  useEffect(() => {
    if (workspaceId) return;
    return subscribeLocalWorkItems(projectId, (next) => {
      const before = itemsRef.current ?? [];
      flash(next.filter((n) => !before.some((b) => b.id === n.id && sameContent(b, n))).map((n) => n.id));
      setItems(next);
    });
  }, [workspaceId, projectId, flash]);

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
    let hasConnected = false;

    const goOffline = () => setStatus("offline");
    const goOnline = () => setStatus((s) => (s === "connected" ? s : "connecting"));
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    (async () => {
      try {
        const pid = await ensureCloudProject(workspaceId, projectId);
        if (cancelled) return;
        projectUuid.current = pid;
        // Subscribe before fetching so nothing that happens during the fetch is missed.
        channel = subscribeWorkItems(pid, viewerRef.current, {
          onChange: ({ type, row }) => {
            // Our own optimistic writes come back identical; only a real difference is a teammate's change.
            const known = itemsRef.current?.find((i) => i.id === row.id);
            if (type !== "DELETE" && (!known || !sameContent(known, row))) flash([row.id]);
            setItems((prev) => {
              if (!prev) return prev;
              if (type === "DELETE") return prev.filter((i) => i.id !== row.id);
              return mergeWorkItemRow(prev, row);
            });
          },
          onStatus: (next) => {
            if (cancelled) return;
            setStatus(next);
            // A re-join after a drop may have missed events, so take the server's version.
            if (next === "connected") {
              if (hasConnected) void reload();
              hasConnected = true;
            }
          },
          onPresence: (viewers) => {
            if (!cancelled) setActiveUsers(viewers);
          },
        });
        let rows = await fetchCloudWorkItems(pid);
        if (rows.length === 0) rows = await seedEmptyCloudProject(pid, projectId, rows, () => cancelled);
        if (!cancelled) setItems(rows);
      } catch (e) {
        if (!cancelled) {
          setError(messageOf(e));
          setStatus("offline");
          setItems((prev) => prev ?? []);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (channel) unsubscribeWorkItems(channel);
    };
  }, [workspaceId, projectId, flash, reload]);

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

  // A channel error is shown as offline: supabase-js keeps retrying and the status flips back when it rejoins.
  const realtimeStatus: "connected" | "connecting" | "offline" =
    !workspaceId || status === "offline" || status === "error" ? "offline" : status;

  return { items, error, add, update, softDelete, realtimeStatus, activeUsers, remoteUpdatedIds };
}
