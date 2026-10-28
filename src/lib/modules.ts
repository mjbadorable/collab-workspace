import { cleanMetaName } from "./checklist";

export type ProjectModule = {
  id: string;
  name: string;
  description: string;
  icon: string;
  lead: string;
  ticketKeys: string[]; // e.g. ["CW-1", "CW-3"]
};

const storageKey = (projectId: string) => `collab-workspace:modules:${projectId}`;
const LEAD = "Marvin Jhay Adorable";

const mod = (id: string, name: string, description: string, icon: string, ticketKeys: string[]): ProjectModule => ({
  id,
  name,
  description,
  icon,
  lead: LEAD,
  ticketKeys,
});

function seedModules(projectId: string): ProjectModule[] {
  if (projectId === "collab-workspace") {
    return [
      mod("seed-cw-rt", "Realtime Collab & Presence", "Live Kanban sync, presence and member permissions.", "⚡", ["CW-1", "CW-3", "CW-6"]),
      mod("seed-cw-ops", "DevOps & Telemetry", "Health checks, GitHub activity, exports and alerts.", "🩺", ["CW-2", "CW-4", "CW-7", "CW-8", "CW-12"]),
      mod("seed-cw-arch", "Process Flows & Architecture", "Flowcharts, repo breakdown, inspector and analytics.", "📐", ["CW-5", "CW-13", "CW-14"]),
      mod("seed-cw-ui", "UI Polish & Themes", "Work item polish, the portfolio view and themes.", "🎨", ["CW-9", "CW-10", "CW-11", "CW-15"]),
    ];
  }
  if (projectId === "exam-reviewer-app") {
    return [
      mod("seed-era-pwa", "Offline Storage & PWA", "IndexedDB schema and offline caching.", "💾", ["ERA-2", "ERA-4"]),
      mod("seed-era-pdf", "Split-Screen PDF Engine", "Reading the exam next to the bubble sheet.", "📄", ["ERA-1"]),
      mod("seed-era-bank", "Mock Exam & Question Bank", "Timed exams, scoring and question banks.", "📝", ["ERA-3"]),
    ];
  }
  if (projectId === "mastersoft-grade-encoding-assistant") {
    return [
      mod("seed-mgea-calc", "Computation & Transmutation", "Grade formulas, rounding and the transmutation table.", "🧮", ["MGEA-1", "MGEA-3"]),
      mod("seed-mgea-pwa", "Offline PWA Cache", "Service worker and IndexedDB sync.", "⚡", ["MGEA-2"]),
      mod("seed-mgea-xls", "Excel Template Parser", "Class record import and Mastersoft templates.", "📊", ["MGEA-4", "MGEA-5"]),
    ];
  }
  return [];
}

// The saved list (seed modules included once anything has been added), else the project's built-in modules.
export function getModules(projectId: string): ProjectModule[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ProjectModule[];
    }
  } catch {
    // corrupt JSON or storage blocked: fall back to the built-ins
  }
  return seedModules(projectId);
}

function saveModules(projectId: string, modules: ProjectModule[]): ProjectModule[] {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(modules));
  } catch {
    // storage blocked: the change lasts for this session only
  }
  return modules;
}

// Saves the whole list (built-in modules included) with the one module changed.
export function updateModule(projectId: string, id: string, patch: Partial<Omit<ProjectModule, "id">>): ProjectModule[] {
  return saveModules(projectId, getModules(projectId).map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function createModule(
  projectId: string,
  input: { name: string; description: string; icon: string; lead: string; ticketKeys: string[] }
): ProjectModule[] {
  const created: ProjectModule = {
    id: crypto.randomUUID(),
    name: cleanMetaName(input.name),
    description: input.description.trim(),
    icon: input.icon.trim() || "📦",
    lead: input.lead.trim(),
    ticketKeys: input.ticketKeys,
  };
  const next = [...getModules(projectId), created];
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    // storage blocked: the module lasts for this session only
  }
  return next;
}
