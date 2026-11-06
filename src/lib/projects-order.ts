// Custom project order: a list of project ids kept in localStorage. Projects missing from the list keep their
// natural order after the listed ones, so new projects need no bookkeeping.

export const PROJECT_ORDER_KEY = "collab-workspace:project-order";
export const PROJECT_ORDER_EVENT = "collab-workspace:project-order-change";

export type MoveDirection = "top" | "up" | "down";

let cachedRaw: string | null = null;
let cachedOrder: string[] = [];

export function loadProjectOrder(): string[] {
  if (typeof window === "undefined") return cachedOrder;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROJECT_ORDER_KEY);
  } catch {
    return cachedOrder;
  }
  // Stable reference while storage is unchanged, as useSyncExternalStore requires.
  if (raw === cachedRaw) return cachedOrder;
  cachedRaw = raw;
  cachedOrder = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) cachedOrder = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // corrupt JSON: treat as no custom order
    }
  }
  return cachedOrder;
}

export function saveProjectOrder(order: string[]): void {
  try {
    localStorage.setItem(PROJECT_ORDER_KEY, JSON.stringify(order));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(PROJECT_ORDER_EVENT));
  window.dispatchEvent(new StorageEvent("storage", { key: PROJECT_ORDER_KEY }));
}

export function sortProjectsByOrder<T extends { id: string }>(projects: T[], order: string[]): T[] {
  if (order.length === 0) return projects;
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return projects
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (rank.get(a.p.id) ?? Infinity) - (rank.get(b.p.id) ?? Infinity) || a.i - b.i)
    .map((x) => x.p);
}

export function reorderProjectIds(currentIds: string[], fromIndex: number, toIndex: number): string[] {
  const max = currentIds.length - 1;
  if (fromIndex < 0 || fromIndex > max || toIndex < 0 || toIndex > max || fromIndex === toIndex) return currentIds;
  const next = [...currentIds];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveProjectId(currentIds: string[], id: string, direction: MoveDirection): string[] {
  const from = currentIds.indexOf(id);
  if (from < 0) return currentIds;
  const to = direction === "top" ? 0 : direction === "up" ? from - 1 : from + 1;
  return reorderProjectIds(currentIds, from, to);
}

export function subscribeProjectOrder(onChange: () => void): () => void {
  window.addEventListener(PROJECT_ORDER_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROJECT_ORDER_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
