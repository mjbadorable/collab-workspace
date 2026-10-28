import type { Edge } from "@xyflow/react";
import type { DiagramNode } from "@/components/diagrams/nodes";
import type { Diagram, Json } from "./database.types";
import { getProjects, SEED_PROJECT, type ProjectRecord } from "./projects";
import { hostingOf } from "./project-stack";
import { supabase } from "./supabase";

// deleted_at mirrors the diagrams table; nothing sets it yet, but the Trash view honours it.
export type StoredDiagram = { nodes: DiagramNode[]; edges: Edge[]; deleted_at?: string | null };

const storageKey = (projectId: string) => `collab-workspace:diagram:${projectId}`;

// Persist only what defines the diagram, not transient UI state (selection, measurements, drag).
export function toStored(nodes: DiagramNode[], edges: Edge[]): StoredDiagram {
  return {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
    })),
  };
}

export function loadDiagram(projectId: string): StoredDiagram | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.nodes) && Array.isArray(parsed?.edges)) return parsed;
  } catch {
    // corrupt JSON or storage unavailable: fall back to the default diagram
  }
  return null;
}

export function restoreDiagram(diagram: StoredDiagram): StoredDiagram {
  return { ...diagram, deleted_at: null };
}

export function saveDiagram(projectId: string, diagram: StoredDiagram): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(diagram));
  } catch {
    // quota exceeded or storage blocked: the editor keeps working in memory
  }
}

// ---------------------------------------------------------------- cloud (Supabase)
// A project has one diagram for now: the first non-deleted row, created on the first save.

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchCloudDiagram(projectUuid: string): Promise<{ id: string; diagram: StoredDiagram } | null> {
  const { data, error } = await client()
    .from("diagrams")
    .select("*")
    .eq("project_id", projectUuid)
    .is("deleted_at", null)
    .order("updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error("The saved diagram is malformed.");
  return { id: data.id, diagram: { nodes: data.nodes as unknown as DiagramNode[], edges: data.edges as unknown as Edge[] } };
}

// Updates the row, or inserts it when the project has no diagram yet. Returns the row id.
export async function saveCloudDiagram(projectUuid: string, id: string | null, diagram: StoredDiagram): Promise<string> {
  const nodes = diagram.nodes as unknown as Json;
  const edges = diagram.edges as unknown as Json;
  if (id) {
    const { data, error } = await client().from("diagrams").update({ nodes, edges }).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (data.length === 0) throw new Error("The diagram could not be saved.");
    return id;
  }
  const { data, error } = await client()
    .from("diagrams")
    .insert({ project_id: projectUuid, name: "User flow", type: "flowchart", nodes, edges })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function fetchCloudDeletedDiagrams(projectUuids: string[]): Promise<Diagram[]> {
  if (projectUuids.length === 0) return [];
  const { data, error } = await client()
    .from("diagrams")
    .select("*")
    .in("project_id", projectUuids)
    .not("deleted_at", "is", null);
  if (error) throw new Error(error.message);
  return data;
}

export async function restoreCloudDiagram(id: string): Promise<void> {
  const { data, error } = await client().from("diagrams").update({ deleted_at: null }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error("That diagram could not be restored.");
}

// ---------------------------------------------------------------- categorized process flows (read-only)

export type FlowCategory = "user" | "system" | "backend";
export type FlowStepKind = "terminal" | "process" | "decision";
export type FlowStep = { id: string; label: string; kind: FlowStepKind; role: string; payload: string };
export type Flow = { category: FlowCategory; title: string; summary: string; steps: FlowStep[] };

export const flowCategories: { value: FlowCategory; label: string; emoji: string; title: string }[] = [
  { value: "user", label: "User Flow", emoji: "👤", title: "How a person moves through the product" },
  { value: "system", label: "System Flow", emoji: "⚙️", title: "How the application layers hand work to each other" },
  { value: "backend", label: "Backend & Storage Flow", emoji: "🗄️", title: "Where data lives and how it is delivered" },
];

export const parseFlowCategory = (value: string | null): FlowCategory =>
  flowCategories.find((c) => c.value === value)?.value ?? "user";

const step = (label: string, kind: FlowStepKind, role: string, payload: string): Omit<FlowStep, "id"> => ({ label, kind, role, payload });
const withIds = (steps: Omit<FlowStep, "id">[]): FlowStep[] => steps.map((s, i) => ({ ...s, id: `s${i + 1}` }));

const meta: Record<FlowCategory, Pick<Flow, "title" | "summary">> = {
  user: { title: "User Flow", summary: "What a person does, start to finish." },
  system: { title: "System Flow", summary: "How the application layers pass work along." },
  backend: { title: "Backend & Storage Flow", summary: "Where data is kept, backed up and delivered." },
};

const EXAM_REVIEWER: Record<FlowCategory, Omit<FlowStep, "id">[]> = {
  user: [
    step("Select Exam Paper", "terminal", "Entry point: pick a saved paper or upload a new PDF.", "pdfId, question bank"),
    step("Split-Screen Viewport", "process", "Shows the exam PDF beside the answer pane.", "PDF page, zoom level, scroll position"),
    step("Bubble Sheet Answering", "process", "The learner marks choices while reading the paper.", "questionId → selected option ids"),
    step("Flagged Item Review", "decision", "Revisit flagged questions before submitting.", "flagged question ids"),
    step("Score & Telemetry Summary", "terminal", "Final score with per-question pacing.", "score %, time per question, weak topics"),
  ],
  system: [
    step("React UI", "terminal", "Renders the split view and captures clicks and keys.", "user events"),
    step("Ephemeral Zustand Store (1s Ticks)", "process", "Holds timer ticks, cursor and zoom with 0 ms UI latency.", "currentIndex, elapsed seconds"),
    step("PDF.js Web Worker", "process", "Rasterises visible pages off the main thread.", "page bitmaps, text layer"),
    step("Atomic Write-Behind Queue", "process", "Debounced flush of answers and progress in one transaction.", "session answers, progress rows"),
    step("IndexedDB", "terminal", "Durable store the UI reads back through live queries.", "examSessions, userProgress"),
  ],
  backend: [
    step("Service Worker Cache Storage (sw.js)", "terminal", "Precaches the app shell so exams open offline.", "HTML, JS, CSS, PDF worker"),
    step("IndexedDB (Dexie v4) · Metadata vs Binary Blobs", "process", "Light metadata stays queryable; heavy PDFs sit in a separate store.", "pdfMetadata (<2 KB), pdfBlobs"),
    step("JSON/ZIP Snapshot Backup", "terminal", "Exports progress, optionally with PDFs, for another device.", ".exambackup.json.gz, .examarchive.zip"),
  ],
};

const COLLAB_WORKSPACE: Record<FlowCategory, Omit<FlowStep, "id">[]> = {
  user: [
    step("Sign in or Local Preview", "terminal", "Open the workspace with Supabase or offline preview.", "auth session, local state"),
    step("Select or Import Project", "process", "Pick an active project or paste any GitHub repo URL.", "project slug, repo metadata"),
    step("Monitor Production Health", "process", "Real-time latency and HTTP uptime status pings.", "status code, latencyMs"),
    step("Track Tasks on Kanban Board", "process", "Manage backlog, in-progress, and completed items.", "work item status & priority"),
    step("Inspect Architectural Flows", "terminal", "Review categorized user, system, and backend flows.", "architecture & Mermaid specs"),
  ],
  system: [
    step("Next.js 16 App Router UI", "terminal", "Server and client components with Turbopack.", "user events & navigation"),
    step("Zustand & Context Providers", "process", "Reactive state across projects, auth, and tasks.", "in-memory state updates"),
    step("GitHub Breakdown & Health APIs", "process", "Server-side routes fetching repo data and uptime.", "external API responses"),
    step("Supabase Realtime & PostgreSQL", "process", "Cloud database with row-level security.", "PostgreSQL records"),
    step("LocalStorage Fallback Layer", "terminal", "100% offline-first local persistence.", "JSON cached state"),
  ],
  backend: [
    step("Vercel Production Deployment", "terminal", "Continuous deployment triggered by git push on main.", "static assets & edge routes"),
    step("Supabase Auth & Token Management", "process", "JWT sessions with micro-thumbnail avatar sync.", "access tokens & user metadata"),
    step("PostgreSQL RLS Protected Schema", "process", "Granular table policies for workspaces and projects.", "workspaces, projects, work_items"),
    step("SSRF-Protected Health Check Route", "terminal", "Safely queries production URLs without LAN probing.", "HTTPS ping telemetry"),
  ],
};

const GRADE_ASSISTANT: Record<FlowCategory, Omit<FlowStep, "id">[]> = {
  user: [
    step("Select Course & Term", "terminal", "Entry point: open a class and choose Prelim, Midterm or Final.", "course, section, term"),
    step("Set Assessment Component Weights (CS % / WE %)", "process", "Defines how Class Standing and Written Exam combine.", "CS %, WE % per term"),
    step("Enter Student Raw Marks", "process", "Type or paste scores from Excel.", "per-student CS and WE raw scores"),
    step("Step Transmutation & Double-Rounding", "process", "Applies Mastersoft's rounding and step table.", "scaled %, table row, term grade"),
    step("TC-009 Threshold Review", "decision", "Checks the passing threshold and flags edge cases.", "pass/fail result, flagged students"),
    step("Export Mastersoft .xlsx", "terminal", "Produces the upload file in Mastersoft's row order.", ".xlsx encoding file"),
  ],
  system: [
    step("Table Input", "terminal", "Gradebook grid where marks are typed or pasted.", "raw cell values"),
    step("Form Validation", "process", "Highlights blank and invalid scores before computing.", "valid / invalid flags"),
    step("rules.v1.json Engine", "process", "Declarative grading rules loaded by the engine.", "weights, transmutation table"),
    step("Grade Computation", "process", "Computes term grades and the Final Rating.", "term grades, Final Rating"),
    step("SheetJS Workbook Generator", "terminal", "Builds the Excel files for download.", "Mastersoft upload workbook"),
  ],
  backend: [
    step("Local Browser Storage", "terminal", "All class data stays on the teacher's computer.", "UI preferences, privacy consent"),
    step("IndexedDB Course Store", "process", "One record per class and section.", "classes, students, scores"),
    step("Local JSON Backup / Restore", "process", "Download a class as a file and restore it anywhere.", "class backup JSON"),
    step("Firebase Hosting Delivery", "terminal", "Serves the app shell; no student data is uploaded.", "static assets over HTTPS"),
  ],
};

const tokens = (stack: string) =>
  stack
    .split(/,(?![^(]*\))/)
    .map((t) => t.trim())
    .filter(Boolean);

// Repos without a hand-written flow get a short pipeline built from their name, functions and stack.
function genericSteps(project: ProjectRecord, category: FlowCategory): Omit<FlowStep, "id">[] {
  const front = tokens(project.frontend_stack);
  const back = tokens(project.backend_stack);
  const host = hostingOf(project.live_url);
  if (category === "user") {
    const fns = project.functions.slice(0, 3);
    const middle = fns.length > 0 ? fns : ["Provide input", "Core processing", "Review result"];
    return [
      step(`Open ${project.name}`, "terminal", "Entry point of the product.", "user session"),
      ...middle.map((label, i) =>
        step(label, i === middle.length - 1 && fns.length === 0 ? "decision" : "process", "A core capability of the project.", "user input and results")
      ),
      step("Finish & Review Output", "terminal", "The person leaves with a result.", "output / saved data"),
    ].slice(0, 5);
  }
  if (category === "system") {
    return [
      step(`Client UI${front.length ? ` · ${front.slice(0, 2).join(", ")}` : ""}`, "terminal", "Renders screens and captures input.", "user events"),
      step("Application State & Logic", "process", "Validates input and applies business rules.", "validated actions"),
      step(back.length ? `Services · ${back[0]}` : "Local Processing", "process", "Does the work that needs data or compute.", "requests and results"),
      step(`Data Layer${back[1] ? ` · ${back[1]}` : ""}`, "process", "Reads and writes persistent data.", "records"),
      step("Response / Render", "terminal", "Results flow back to the interface.", "view state"),
    ];
  }
  return [
    step("Request / Event", "terminal", "Something asks for or changes data.", "request payload"),
    step(`Storage${back[0] ? ` · ${back[0]}` : ""}`, "process", "Primary data store.", "records"),
    step(`Persistence${back[1] ? ` · ${back[1]}` : " & Backup"}`, "process", "Secondary storage, caching or backup.", "snapshots, cache"),
    step(`Hosting${host ? ` · ${host}` : ""}`, "process", "Where the production build is served from.", "static assets / API"),
    step("Monitoring · Health Checks", "terminal", "Silph DevOps pings the live URL.", "status, latency"),
  ];
}

// ---- custom flows: a project's edited steps replace the built-in ones for that category

const customFlowKey = (projectId: string, category: FlowCategory) => `collab-workspace:custom-flow:${projectId}:${category}`;
const KINDS: FlowStepKind[] = ["terminal", "process", "decision"];

const isFlowStep = (v: unknown): v is FlowStep => {
  if (typeof v !== "object" || v === null) return false;
  const s = v as FlowStep;
  return (
    typeof s.id === "string" &&
    typeof s.label === "string" &&
    KINDS.includes(s.kind) &&
    typeof s.role === "string" &&
    typeof s.payload === "string"
  );
};

function readCustomFlow(projectId: string, category: FlowCategory): FlowStep[] | null {
  try {
    const raw = localStorage.getItem(customFlowKey(projectId, category));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isFlowStep)) return parsed;
  } catch {
    // corrupt JSON or storage blocked: use the built-in flow
  }
  return null;
}

export const hasCustomFlow = (projectId: string, category: FlowCategory) => readCustomFlow(projectId, category) !== null;

// Step ids are kept as given (they key runbook notes and Mermaid nodes), so reordering a step never moves its notes.
export function saveCustomFlow(projectId: string, category: FlowCategory, steps: FlowStep[]): void {
  try {
    localStorage.setItem(customFlowKey(projectId, category), JSON.stringify(steps));
  } catch {
    // storage blocked: the edit lasts until the page is reloaded
  }
}

export function resetCustomFlow(projectId: string, category: FlowCategory): void {
  try {
    localStorage.removeItem(customFlowKey(projectId, category));
  } catch {
    // nothing stored to remove
  }
}

export function getFlow(projectId: string, category: FlowCategory): Flow {
  const custom = readCustomFlow(projectId, category);
  if (custom) return { category, ...meta[category], steps: custom };
  const project = getProjects().find((p) => p.id === projectId);
  const handWritten =
    projectId === "exam-reviewer-app"
      ? EXAM_REVIEWER
      : projectId === "mastersoft-grade-encoding-assistant"
        ? GRADE_ASSISTANT
        : projectId === "collab-workspace"
          ? COLLAB_WORKSPACE
          : null;
  const steps =
    handWritten?.[category] ??
    genericSteps(project ?? { ...SEED_PROJECT, id: projectId, name: projectId, functions: [], frontend_stack: "", backend_stack: "", live_url: "" }, category);
  return { category, ...meta[category], steps: withIds(steps) };
}

const mermaidLabel = (text: string) => text.replace(/"/g, "'");

// Mermaid flowchart for one category: terminals are stadiums, decisions are diamonds.
export function getMermaidForCategory(projectId: string, category: FlowCategory): string {
  const project = getProjects().find((p) => p.id === projectId);
  const flow = getFlow(projectId, category);
  const shape = (s: FlowStep) => {
    const label = mermaidLabel(s.label);
    return s.kind === "terminal" ? `${s.id}(["${label}"])` : s.kind === "decision" ? `${s.id}{"${label}"}` : `${s.id}["${label}"]`;
  };
  return [`%% ${project?.name ?? projectId} - ${flow.title}`, "flowchart LR", ...flow.steps.map((s, i) => (i === 0 ? `  ${shape(s)}` : `  ${flow.steps[i - 1].id} --> ${shape(s)}`))].join("\n");
}
