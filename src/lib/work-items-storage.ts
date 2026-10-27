import type { WorkItem } from "./database.types";
import { mockUser } from "./mock-data";
import { getProjects } from "./projects";
import { supabase } from "./supabase";

export type WorkItemStatus = WorkItem["status"];
export type WorkItemPriority = WorkItem["priority"];

// Matches the work_items table, plus a per-project sequence number for ERA-1 style keys
// (the schema has no sequence column yet).
export type StoredWorkItem = WorkItem & { seq: number };

export type NewWorkItemInput = {
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
};

const storageKey = (projectId: string) => `collab-workspace:work-items:${projectId}`;

export function projectIdentifier(projectId: string): string {
  const known = getProjects().find((p) => p.id === projectId)?.identifier;
  return known ?? (projectId.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "WI");
}

export function workItemKey(projectId: string, seq: number): string {
  return `${projectIdentifier(projectId)}-${seq}`;
}

function seedItems(projectId: string): StoredWorkItem[] {
  if (projectId !== "exam-reviewer-app") return [];

  const seed = (
    seq: number,
    title: string,
    status: WorkItemStatus,
    priority: WorkItemPriority,
    assignee_id: string | null
  ): StoredWorkItem => ({
    id: `seed-${projectId}-${seq}`,
    seq,
    project_id: projectId,
    title,
    description: null,
    status,
    priority,
    assignee_id,
    deleted_at: null,
    created_at: `2026-10-2${seq}T09:00:00.000Z`,
  });

  return [
    seed(1, "Build split-screen PDF viewer with interactive bubble sheet", "in_progress", "high", mockUser.id),
    seed(2, "Design IndexedDB schema for offline exam papers", "done", "medium", mockUser.id),
    seed(3, "Implement ITPEC FE/IP exam timer and scoring heuristics", "backlog", "high", null),
    seed(4, "Create mock exam selection dashboard", "backlog", "medium", null),
  ];
}

export function loadWorkItems(projectId: string): StoredWorkItem[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupt JSON or storage unavailable: fall back to the seed data
  }
  return seedItems(projectId);
}

export function saveWorkItems(projectId: string, items: StoredWorkItem[]): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(items));
  } catch {
    // quota exceeded or storage blocked: changes stay in memory only
  }
}

// Soft-deleted items keep their seq, so keys are never reused.
export function addWorkItem(items: StoredWorkItem[], projectId: string, input: NewWorkItemInput): StoredWorkItem[] {
  const seq = items.reduce((max, i) => Math.max(max, i.seq), 0) + 1;
  const item: StoredWorkItem = {
    id: crypto.randomUUID(),
    seq,
    project_id: projectId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    status: input.status,
    priority: input.priority,
    assignee_id: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
  };
  return [...items, item];
}

export function updateWorkItem(items: StoredWorkItem[], id: string, patch: Partial<WorkItem>): StoredWorkItem[] {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

export function softDeleteWorkItem(items: StoredWorkItem[], id: string): StoredWorkItem[] {
  return updateWorkItem(items, id, { deleted_at: new Date().toISOString() });
}

export function restoreWorkItem(items: StoredWorkItem[], id: string): StoredWorkItem[] {
  return updateWorkItem(items, id, { deleted_at: null });
}

// ---------------------------------------------------------------- cloud (Supabase)
// The table has no sequence column, so seq is each item's rank by created_at within its project.
// Items are only ever soft-deleted, so ranks (and ERA-style keys) never shift.

export function assignSeq(rows: WorkItem[]): StoredWorkItem[] {
  const counters = new Map<string, number>();
  return [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((row) => {
      const seq = (counters.get(row.project_id) ?? 0) + 1;
      counters.set(row.project_id, seq);
      return { ...row, seq };
    });
}

// Applies a row from an insert, an update or a realtime event. New rows are the newest, so they take the next seq.
export function mergeWorkItemRow(items: StoredWorkItem[], row: WorkItem): StoredWorkItem[] {
  if (items.some((i) => i.id === row.id)) return items.map((i) => (i.id === row.id ? { ...row, seq: i.seq } : i));
  return [...items, { ...row, seq: items.reduce((max, i) => Math.max(max, i.seq), 0) + 1 }];
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchCloudWorkItems(projectUuid: string): Promise<StoredWorkItem[]> {
  const { data, error } = await client().from("work_items").select("*").eq("project_id", projectUuid);
  if (error) throw new Error(error.message);
  return assignSeq(data);
}

export async function fetchCloudWorkItemsForProjects(projectUuids: string[]): Promise<StoredWorkItem[]> {
  if (projectUuids.length === 0) return [];
  const { data, error } = await client().from("work_items").select("*").in("project_id", projectUuids);
  if (error) throw new Error(error.message);
  return assignSeq(data);
}

export async function insertCloudWorkItem(projectUuid: string, input: NewWorkItemInput): Promise<WorkItem> {
  const { data, error } = await client()
    .from("work_items")
    .insert({
      project_id: projectUuid,
      title: input.title.trim(),
      description: input.description.trim() || null,
      status: input.status,
      priority: input.priority,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Only real columns are sent. RLS hides rows from non-members rather than erroring, so zero rows back means "not allowed".
export async function updateCloudWorkItem(id: string, patch: Partial<WorkItem>): Promise<void> {
  const { title, description, status, priority, assignee_id, deleted_at } = patch;
  // Undefined fields are dropped when the body is serialized, so only the keys in the patch are written.
  const columns: Partial<WorkItem> = { title, description, status, priority, assignee_id, deleted_at };
  const { data, error } = await client().from("work_items").update(columns).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("That work item could not be updated.");
}

export type WorkItemChange = { type: "INSERT" | "UPDATE" | "DELETE"; row: WorkItem };

// Needs the table in the supabase_realtime publication (see supabase/realtime.sql). RLS applies to what is delivered.
export function subscribeWorkItems(projectUuid: string, onChange: (change: WorkItemChange) => void) {
  return client()
    .channel(`work_items_changes:${projectUuid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "work_items", filter: `project_id=eq.${projectUuid}` },
      (payload) => {
        const type = payload.eventType;
        const row = (type === "DELETE" ? payload.old : payload.new) as Partial<WorkItem>;
        if (row.id) onChange({ type, row: row as WorkItem });
      }
    )
    .subscribe();
}

export function unsubscribeWorkItems(channel: ReturnType<typeof subscribeWorkItems>): void {
  void supabase?.removeChannel(channel);
}
