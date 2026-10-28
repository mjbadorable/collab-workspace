import { useCallback, useEffect, useRef, useState } from "react";
import { logActivity } from "./activity-log";
import { localDateIso, withCompletedDate } from "./checklist";
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

// One-time cloud upgrade so a workspace seeded before CW-6..CW-9 finished gets the missing items and marks CW-1..CW-9 done.
async function upgradeCollabCloudProject(
  projectUuid: string,
  projectId: string,
  current: StoredWorkItem[],
  isCancelled: () => boolean
): Promise<StoredWorkItem[]> {
  if (projectId !== "collab-workspace") return current;
  const guard = `collab-workspace:cloud-nextgen-v3:${projectUuid}`;
  try {
    if (localStorage.getItem(guard)) return current;
    localStorage.setItem(guard, "1");
  } catch {
    return current;
  }
  const seeds = seedItems("collab-workspace");
  let changed = false;
  for (const s of seeds) {
    if (isCancelled()) return current;
    const match = current.find((r) => !r.deleted_at && r.title === s.title);
    if (!match) {
      await insertCloudWorkItem(projectUuid, {
        title: s.title,
        description: s.description ?? "",
        status: "done",
        priority: s.priority,
      });
      changed = true;
    } else if (match.status !== "done") {
      await updateCloudWorkItem(match.id, { status: "done" });
      changed = true;
    }
  }
  return changed ? fetchCloudWorkItems(projectUuid) : current;
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
  const cloudSynced = useRef(false);
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

  // Local preview saves every change. Signed in, the cloud copy is mirrored to the same local key as a read cache
  // (the command palette, the portfolio view and the node inspector read it), but only after a successful fetch,
  // so a failed load can never overwrite the cache with an empty list.
  useEffect(() => {
    if (items && (!workspaceId || cloudSynced.current)) saveWorkItems(projectId, items);
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
      const rows = await fetchCloudWorkItems(projectUuid.current);
      cloudSynced.current = true;
      saveWorkItems(projectId, rows);
      setItems(rows);
    } catch (e) {
      setError(messageOf(e));
    }
  }, [projectId]);

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
        else rows = await upgradeCollabCloudProject(pid, projectId, rows, () => cancelled);
        if (!cancelled) {
          cloudSynced.current = true;
          saveWorkItems(projectId, rows);
          setItems(rows);
        }
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

  const add = (raw: NewWorkItemInput) => {
    // An item created already done gets its completion date too.
    const input: NewWorkItemInput =
      raw.status === "done" ? { ...raw, description: withCompletedDate(raw.description, localDateIso()) ?? "" } : raw;
    logActivity({ kind: "task", title: "Work item created", detail: input.title.trim() });
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
  const update = (id: string, rawPatch: Partial<WorkItem>) => {
    const before = itemsRef.current?.find((i) => i.id === id);
    let patch = rawPatch;
    if (before && rawPatch.status !== undefined && (rawPatch.status === "done") !== (before.status === "done")) {
      // Moving into done stamps today's date (the burndown chart reads it); moving out clears it.
      const finished = rawPatch.status === "done";
      patch = {
        ...rawPatch,
        description: withCompletedDate(rawPatch.description !== undefined ? rawPatch.description : before.description, finished ? localDateIso() : null),
      };
      if (finished) logActivity({ kind: "task", title: "Work item completed", detail: before.title });
    }
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
