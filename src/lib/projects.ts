import type { Project } from "./database.types";
import { supabase } from "./supabase";

// Project metadata. The registry lives in localStorage in every mode (routes use its slug ids); when signed in,
// changes are mirrored to the Supabase `projects` table and unknown cloud projects are merged back in.
export type ProjectRecord = {
  id: string; // URL slug, e.g. "exam-reviewer-app"
  name: string;
  identifier: string; // "ERA": work items are numbered ERA-1, ERA-2, ...
  description: string;
  icon: string | null; // emoji; null falls back to the name's first letter
  is_public: boolean;
  github_url: string;
  live_url: string;
  functions: string[]; // core capabilities, shown on the Overview
  frontend_stack: string; // comma-separated, e.g. "React 19, Vite 8, Tailwind CSS v4"
  backend_stack: string; // comma-separated, e.g. "IndexedDB (Dexie.js v4), Service Worker"
  lead: string | null; // local-only
  created_at: string;
};

export type ProjectInput = Pick<ProjectRecord, "name" | "identifier"> &
  Partial<
    Pick<
      ProjectRecord,
      "description" | "icon" | "is_public" | "github_url" | "live_url" | "lead" | "functions" | "frontend_stack" | "backend_stack"
    >
  >;

export const SEED_PROJECT: ProjectRecord = {
  id: "exam-reviewer-app",
  name: "Exam Reviewer App",
  identifier: "ERA",
  description:
    "An offline-first exam reviewer for people who study from paper exams and PDFs. Read the exam on one side and answer on the other, with no account and no server: everything stays on the device.",
  icon: null,
  is_public: true,
  github_url: "https://github.com/mjbadorable/exam-reviewer-app",
  live_url: "https://exam-reviewer.vercel.app",
  functions: [
    "Upload exam PDFs and read them side by side with an answer sheet",
    "Bubble-sheet mode for practising against paper exams",
    "Timed mock exams and untimed practice sessions",
    "Question banks with explanations and topic tags",
    "Bookmarks, notes and spaced-repetition review",
    "Backup and restore progress as a file",
  ],
  frontend_stack: "React 19, Vite 8, TypeScript, Tailwind CSS v4, Zustand, PDF.js, Lucide",
  backend_stack: "IndexedDB (Dexie.js v4), Custom Service Worker, Cache Storage API, navigator.storage.persist()",
  lead: null,
  created_at: "2026-10-01T00:00:00.000Z",
};

export const GRADE_ASSISTANT_PROJECT: ProjectRecord = {
  id: "mastersoft-grade-encoding-assistant",
  name: "Mastersoft Grade Encoding Assistant",
  identifier: "MGEA",
  description:
    "A browser-based companion calculator for faculty of the University of San Agustin. It shows teachers exactly what to enter in Mastersoft and exactly what grade Mastersoft will produce, before they encode anything.",
  icon: "🎓",
  is_public: true,
  github_url: "https://github.com/mjbadorable/Mastersoft-Grade-Encoding-Assistant",
  live_url: "https://mastersoft-grade-assistant.web.app",
  functions: [
    "Gradebook per class and section covering Prelim, Midterm and Final",
    "Computes the exact Total Marks and marks to encode in Mastersoft",
    "Step-by-step breakdown of how each grade is produced",
    "Excel import from class records, and Mastersoft import/export files",
    "Final Rating summary and Final Rating Only mode",
    "Printable Encoding Guide (PDF or .xlsx) and JSON backup/restore",
  ],
  frontend_stack: "React 19, Vite 8, TypeScript, Tailwind CSS v4, Radix UI, Zustand",
  backend_stack: "IndexedDB (Dexie.js v4), SheetJS (Excel), Service Worker (offline), Vitest",
  lead: null,
  created_at: "2026-10-02T00:00:00.000Z",
};

export const COLLAB_WORKSPACE_PROJECT: ProjectRecord = {
  id: "collab-workspace",
  name: "Collab Workspace (DevOps Portal)",
  identifier: "CW",
  description:
    "Collaborative engineering control plane and monitoring dashboard with real-time health checks, plug-and-play GitHub breakdowns, and categorized process flows.",
  icon: "pokeball",
  is_public: true,
  github_url: "https://github.com/mjbadorable/collab-workspace",
  live_url: "https://collab-workspace-mu.vercel.app",
  functions: [
    "Multi-project monitoring and control plane with dynamic sidebar trees",
    "Plug-and-play GitHub repository breakdown with auto-generated tasks and stack detection",
    "Real-time production health monitoring with latency telemetry and SSRF guards",
    "Agile work items with 3-column Kanban board, list view, and HTML5 drag-and-drop",
    "Smart categorized process flow visualizer (User Flow, System Flow, Backend Flow)",
    "Personalized profile management with Pokémon League titles and photo upload",
  ],
  frontend_stack: "Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, React Flow (@xyflow/react), Lucide Icons",
  backend_stack: "Supabase PostgreSQL, Row-Level Security (RLS), Supabase Auth, Browser LocalStorage Fallback",
  lead: "Marvin Jhay Adorable",
  created_at: "2026-10-26T00:00:00.000Z",
};

export const SEED_PROJECTS: ProjectRecord[] = [SEED_PROJECT, GRADE_ASSISTANT_PROJECT, COLLAB_WORKSPACE_PROJECT];

const KEY = "collab-workspace:projects";
const SEEDED_FLAG = "collab-workspace:projects-seeded-v3";
const listeners = new Set<() => void>();

// useSyncExternalStore needs a referentially stable snapshot, so the parsed list is cached per raw string.
let cachedRaw: string | null = null;
let cachedList: ProjectRecord[] = SEED_PROJECTS;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getProjects(): ProjectRecord[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  cachedList = SEED_PROJECTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cachedList = dedupeByIdentifier((parsed as Partial<ProjectRecord>[]).map(normalize));
    } catch {
      // corrupt JSON: fall back to the seed
    }
  }
  return cachedList;
}

const filled = (value: string | null | undefined) => (value?.trim() ? value : undefined);

// A seeded project (matched by id or identifier) is always complete: its canonical id is forced and any blank
// field takes the seed's value, so a bare record from an older version or from Supabase repairs itself.
// Other records only get empty values for fields that did not exist when they were saved.
function normalize(p: Partial<ProjectRecord>): ProjectRecord {
  const seed = SEED_PROJECTS.find((s) => s.id === p.id || s.identifier === p.identifier);
  if (!seed) {
    return {
      ...(p as ProjectRecord),
      functions: Array.isArray(p.functions) ? p.functions : [],
      frontend_stack: p.frontend_stack ?? "",
      backend_stack: p.backend_stack ?? "",
    };
  }
  return {
    ...seed,
    ...(p as ProjectRecord),
    id: seed.id,
    description: filled(p.description) ?? seed.description,
    icon: seed.id === "collab-workspace" && (!p.icon || p.icon === "⚡") ? "pokeball" : p.icon || seed.icon,
    github_url: filled(p.github_url) ?? seed.github_url,
    live_url: filled(p.live_url) ?? seed.live_url,
    functions: Array.isArray(p.functions) && p.functions.length > 0 ? p.functions : seed.functions,
    frontend_stack: filled(p.frontend_stack) ?? seed.frontend_stack,
    backend_stack: filled(p.backend_stack) ?? seed.backend_stack,
    lead: p.lead ?? seed.lead,
  };
}

// Identifiers are unique, so a second record with the same one is a stale duplicate (e.g. the old CW slug).
function dedupeByIdentifier(list: ProjectRecord[]): ProjectRecord[] {
  const seen = new Set<string>();
  return list.filter((p) => !seen.has(p.identifier) && !!seen.add(p.identifier));
}

// Once per version: adds the seeded projects an older saved registry doesn't have (e.g. the Grade Assistant)
// and saves the repaired registry so the fixes persist.
export function ensureSeedProjects() {
  try {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    localStorage.setItem(SEEDED_FLAG, "1");
  } catch {
    return;
  }
  if (readRaw() === null) return;
  const list = getProjects();
  const missing = SEED_PROJECTS.filter((s) => !list.some((p) => p.identifier === s.identifier));
  write([...list, ...missing]);
}

export function subscribeProjects(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function write(list: ProjectRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: nothing persists, but the session keeps working from the last snapshot
    return;
  }
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------- helpers

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

export { normalizeIdentifier, suggestIdentifier } from "./identifier";

// ---------------------------------------------------------------- local mutations

export function createLocalProject(input: ProjectInput): ProjectRecord {
  const list = getProjects();
  const base = slugify(input.name);
  let id = base;
  for (let n = 2; list.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const record: ProjectRecord = {
    id,
    name: input.name.trim(),
    identifier: input.identifier,
    description: input.description?.trim() ?? "",
    icon: input.icon ?? null,
    is_public: input.is_public ?? true,
    github_url: input.github_url?.trim() ?? "",
    live_url: input.live_url?.trim() ?? "",
    lead: input.lead ?? null,
    functions: input.functions ?? [],
    frontend_stack: input.frontend_stack?.trim() ?? "",
    backend_stack: input.backend_stack?.trim() ?? "",
    created_at: new Date().toISOString(),
  };
  write([...list, record]);
  return record;
}

export function updateLocalProject(id: string, patch: Partial<Omit<ProjectRecord, "id" | "created_at">>) {
  write(getProjects().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function deleteLocalProject(id: string) {
  write(getProjects().filter((p) => p.id !== id));
}

// Merges cloud projects into the local registry. Matching is by identifier, which is unique per workspace.
// Known projects only gain what they lack (a bare cloud row never blanks richer local data); unknown ones are added,
// seeded identifiers under their canonical id instead of a slug of the cloud name.
export function mergeRemoteProjects(rows: Project[]) {
  const list = getProjects();
  const next = [...list];
  for (const r of rows) {
    const index = next.findIndex((p) => p.identifier === r.identifier);
    if (index >= 0) {
      const local = next[index];
      next[index] = {
        ...local,
        description: filled(local.description) ?? r.description ?? "",
        icon: local.icon || r.icon,
        github_url: filled(local.github_url) ?? r.github_url ?? "",
        live_url: filled(local.live_url) ?? r.live_url ?? "",
        functions: local.functions.length > 0 ? local.functions : (r.functions ?? []),
        frontend_stack: filled(local.frontend_stack) ?? r.frontend_stack ?? "",
        backend_stack: filled(local.backend_stack) ?? r.backend_stack ?? "",
      };
      continue;
    }
    const seed = SEED_PROJECTS.find((s) => s.identifier === r.identifier);
    const base = seed?.id ?? slugify(r.name);
    let id = base;
    for (let n = 2; next.some((p) => p.id === id); n++) id = `${base}-${n}`;
    next.push(
      normalize({
        id,
        name: r.name,
        identifier: r.identifier,
        description: r.description ?? "",
        icon: r.icon,
        is_public: r.is_public ?? true,
        github_url: r.github_url ?? "",
        live_url: r.live_url ?? "",
        functions: r.functions ?? [],
        frontend_stack: r.frontend_stack ?? "",
        backend_stack: r.backend_stack ?? "",
        lead: null,
        created_at: r.created_at,
      })
    );
  }
  if (JSON.stringify(next) !== JSON.stringify(list)) write(next);
}

// ---------------------------------------------------------------- cloud mirror

export const projectColumns = (p: ProjectRecord) => ({
  name: p.name,
  description: p.description || null,
  icon: p.icon,
  is_public: p.is_public,
  github_url: p.github_url || null,
  live_url: p.live_url || null,
  functions: p.functions,
  frontend_stack: p.frontend_stack || null,
  backend_stack: p.backend_stack || null,
});

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchCloudProjects(workspaceId: string): Promise<Project[]> {
  const { data, error } = await client().from("projects").select("*").eq("workspace_id", workspaceId).is("deleted_at", null);
  if (error) throw new Error(error.message);
  return data;
}

// Inserts the project, or revives/updates the row when its identifier already exists in the workspace.
export async function pushCloudProject(workspaceId: string, project: ProjectRecord): Promise<void> {
  const db = client();
  const { data: existing, error: lookupError } = await db
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("identifier", project.identifier)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const { error } = existing
    ? await db.from("projects").update({ ...projectColumns(project), deleted_at: null }).eq("id", existing.id)
    : await db.from("projects").insert({ workspace_id: workspaceId, identifier: project.identifier, ...projectColumns(project) });
  if (error) throw new Error(error.message);
}

export async function removeCloudProject(workspaceId: string, identifier: string): Promise<void> {
  const { error } = await client()
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("identifier", identifier);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- diagrams

export type ProjectDiagram = { id: "user" | "system" | "backend"; name: string; href: string };

// The Diagrams subtree lists the three read-only flow categories.
export function getProjectDiagrams(projectId: string): ProjectDiagram[] {
  return [
    { id: "user", name: "User Flow", href: `/projects/${projectId}/diagrams?category=user` },
    { id: "system", name: "System Flow", href: `/projects/${projectId}/diagrams?category=system` },
    { id: "backend", name: "Backend Flow", href: `/projects/${projectId}/diagrams?category=backend` },
  ];
}
