import type { WorkItem } from "./database.types";
import { mockProjects, mockUser } from "./mock-data";

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
  const known = mockProjects.find((p) => p.id === projectId)?.identifier;
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
