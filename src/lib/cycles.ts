import { cleanMetaName, localDateIso, parseDescription } from "./checklist";
import type { StoredWorkItem } from "./work-items-storage";

export type CycleStatus = "active" | "upcoming" | "completed";

export type Cycle = {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, the last day of the cycle
  status: CycleStatus;
};

const storageKey = (projectId: string) => `collab-workspace:cycles:${projectId}`;

const cycle = (id: string, name: string, description: string, startDate: string, endDate: string, status: CycleStatus): Cycle => ({
  id,
  name,
  description,
  startDate,
  endDate,
  status,
});

function seedCycles(projectId: string): Cycle[] {
  if (projectId === "collab-workspace") {
    return [
      cycle("seed-cw-1", "Cycle 1: DevOps & Self-Hosting Telemetry", "Health monitoring, GitHub activity and exports.", "2026-10-19", "2026-10-26", "completed"),
      cycle("seed-cw-2", "Cycle 2: Realtime Collab & Command Center", "Live Kanban sync, permissions and the portfolio view.", "2026-10-26", "2026-11-02", "active"),
      cycle("seed-cw-3", "Cycle 3: Next-Gen Automation & Theme Suite", "Webhooks, analytics, inspector and themes.", "2026-11-02", "2026-11-16", "upcoming"),
    ];
  }
  if (projectId === "exam-reviewer-app") {
    return [
      cycle("seed-era-1", "Cycle 1: Offline DB & Storage Guards", "IndexedDB schema and storage persistence.", "2026-10-15", "2026-10-22", "completed"),
      cycle("seed-era-2", "Cycle 2: Split-Screen PDF Viewer & Bubble Sheet", "Reading and answering side by side.", "2026-10-22", "2026-10-28", "completed"),
      cycle("seed-era-3", "Cycle 3: Text Extraction Worker & Question Bank", "Extract questions and build the bank.", "2026-10-29", "2026-11-12", "active"),
    ];
  }
  if (projectId === "mastersoft-grade-encoding-assistant") {
    return [
      cycle("seed-mgea-1", "Cycle 1: Grading Formula Engine & Double-Rounding", "Core computation and rounding rules.", "2026-10-10", "2026-10-20", "completed"),
      cycle("seed-mgea-2", "Cycle 2: Excel Parser, OBE Engine & VPAA Exporter", "Import class records, OBE attainment and VPAA workbook.", "2026-10-20", "2026-10-27", "completed"),
      cycle("seed-mgea-3", "Cycle 3: High-Priority Hardening (Undo, Overview, TC-009)", "Change history undo/redo, all-classes readiness dashboard and edge-case guards.", "2026-10-28", "2026-11-10", "active"),
    ];
  }
  return [];
}

// The saved list (seed cycles included once anything has been changed), else the project's built-in cycles.
export function getCycles(projectId: string): Cycle[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Cycle[];
    }
  } catch {
    // corrupt JSON or storage blocked: fall back to the built-ins
  }
  return seedCycles(projectId);
}

function save(projectId: string, cycles: Cycle[]): Cycle[] {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(cycles));
  } catch {
    // storage blocked: the change lasts for this session only
  }
  return cycles;
}

const todayIso = () => localDateIso();

export function createCycle(
  projectId: string,
  input: { name: string; description: string; startDate: string; endDate: string }
): Cycle[] {
  const today = todayIso();
  const status: CycleStatus = input.endDate < today ? "completed" : input.startDate > today ? "upcoming" : "active";
  const created: Cycle = {
    id: crypto.randomUUID(),
    name: cleanMetaName(input.name),
    description: input.description.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    status,
  };
  return save(projectId, [...getCycles(projectId), created]);
}

export function updateCycle(projectId: string, id: string, patch: Partial<Omit<Cycle, "id">>): Cycle[] {
  return save(projectId, getCycles(projectId).map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Whole days from today to the cycle's last day: positive while it runs, 0 on the last day, negative once over.
export function daysRemaining(c: Cycle): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDay(c.endDate).getTime() - today.getTime()) / 86_400_000);
}

export function formatRange(c: Cycle): string {
  const fmt = (iso: string) => parseDay(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(c.startDate)} – ${fmt(c.endDate)}`;
}

export type BurndownDay = {
  date: string;
  day: number; // 1-based
  ideal: number;
  actual: number | null; // null for days that have not happened yet
};

const addDays = (iso: string, n: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return localDateIso(d);
};

// Day by day from the cycle's start to its end: the ideal line falls straight from the item count to 0, and the
// actual line is what was still open at the end of each day that has already happened. An item counts as
// finished on its [completed: date] stamp; a done item without one (finished before stamps existed) is
// counted on the day it was created, kept within the cycle.
export function computeBurndownData(
  cycle: Cycle,
  items: StoredWorkItem[],
  allCycles: Cycle[] = [cycle]
): { total: number; days: BurndownDay[] } {
  const mine = items.filter(
    (i) => !i.deleted_at && itemCycleId(allCycles, parseDescription(i.description).cycle, i.created_at) === cycle.id
  );
  const finishedOn = mine.flatMap((i) => {
    if (i.status !== "done") return [];
    return [parseDescription(i.description).completedDate ?? i.created_at.slice(0, 10)];
  });

  const total = mine.length;
  const length = Math.max(1, Math.round((parseDay(cycle.endDate).getTime() - parseDay(cycle.startDate).getTime()) / 86_400_000) + 1);
  const today = todayIso();
  const days: BurndownDay[] = [];
  for (let i = 0; i < length; i++) {
    const date = addDays(cycle.startDate, i);
    days.push({
      date,
      day: i + 1,
      ideal: length > 1 ? total * (1 - i / (length - 1)) : 0,
      actual: date <= today ? total - finishedOn.filter((d) => d <= date).length : null,
    });
  }
  return { total, days };
}

// A work item belongs to the cycle it is tagged with ([cycle: name]); an untagged one falls into the cycle
// whose dates contain the day it was created.
export function itemCycleId(cycles: Cycle[], tag: string | null, createdAt: string): string | null {
  if (tag) return cycles.find((c) => c.name === tag)?.id ?? null;
  const day = createdAt.slice(0, 10);
  return cycles.find((c) => day >= c.startDate && day <= c.endDate)?.id ?? null;
}
