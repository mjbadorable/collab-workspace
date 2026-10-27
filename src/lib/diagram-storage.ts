import type { Edge } from "@xyflow/react";
import type { DiagramNode } from "@/components/diagrams/nodes";
import type { Diagram, Json } from "./database.types";
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

type Step = { id: string; label: string; type: "terminal" | "process" | "decision"; x: number; y: number };

function flow(steps: Step[]): StoredDiagram {
  const nodes: DiagramNode[] = steps.map(({ id, label, type, x, y }) => ({ id, type, position: { x, y }, data: { label } }));
  const edges: Edge[] = nodes.slice(1).map((n, i) => ({
    id: `e-${nodes[i].id}-${n.id}`,
    source: nodes[i].id,
    target: n.id,
    sourceHandle: "right",
    targetHandle: "left",
  }));
  return { nodes, edges };
}

// Every project opens with a starter process flow, never an empty canvas.
export function defaultDiagram(projectId: string): StoredDiagram {
  if (projectId === "exam-reviewer-app") {
    return flow([
      { id: "start", label: "Start", type: "terminal", x: 0, y: 0 },
      { id: "login", label: "Student Login", type: "process", x: 230, y: 0 },
      { id: "select", label: "Select Exam", type: "process", x: 460, y: 0 },
      { id: "answer", label: "Answer Sheet", type: "process", x: 690, y: 0 },
      { id: "score", label: "Score Summary", type: "process", x: 920, y: 0 },
      { id: "end", label: "End", type: "terminal", x: 1150, y: 0 },
    ]);
  }
  if (projectId === "mastersoft-grade-encoding-assistant") {
    return flow([
      { id: "course", label: "Faculty Course Selection", type: "terminal", x: 0, y: 100 },
      { id: "weights", label: "Set Assessment Weights (CS % & WE %)", type: "process", x: 240, y: 100 },
      { id: "scores", label: "Enter Student Raw Scores", type: "process", x: 480, y: 100 },
      { id: "rounding", label: "Double-Rounding & Step Transmutation", type: "process", x: 720, y: 100 },
      { id: "threshold", label: "TC-009 Passing Threshold Check", type: "decision", x: 960, y: 80 },
      { id: "export", label: "Export Mastersoft .xlsx & Save IDB", type: "terminal", x: 1200, y: 100 },
    ]);
  }
  return flow([
    { id: "start", label: "Start", type: "terminal", x: 0, y: 100 },
    { id: "ingest", label: "Ingest Data / Configuration", type: "process", x: 240, y: 100 },
    { id: "process", label: "Core Processing", type: "process", x: 480, y: 100 },
    { id: "validate", label: "Validation / Decision", type: "decision", x: 720, y: 80 },
    { id: "output", label: "Output & Storage", type: "terminal", x: 960, y: 100 },
  ]);
}

// The saved diagram, or the starter flow when nothing (or an empty canvas) was saved.
export function initialDiagram(projectId: string): StoredDiagram {
  const saved = loadDiagram(projectId);
  return saved && saved.nodes.length > 0 ? saved : defaultDiagram(projectId);
}
