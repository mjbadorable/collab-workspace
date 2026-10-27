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

export function defaultDiagram(projectId: string): StoredDiagram {
  if (projectId !== "exam-reviewer-app") return { nodes: [], edges: [] };

  const step = (id: string, label: string, type: string, i: number): DiagramNode => ({
    id,
    type,
    position: { x: i * 230, y: 0 },
    data: { label },
  });
  const nodes = [
    step("start", "Start", "terminal", 0),
    step("login", "Student Login", "process", 1),
    step("select", "Select Exam", "process", 2),
    step("answer", "Answer Sheet", "process", 3),
    step("score", "Score Summary", "process", 4),
    step("end", "End", "terminal", 5),
  ];
  const edges: Edge[] = nodes.slice(1).map((n, i) => ({
    id: `e-${nodes[i].id}-${n.id}`,
    source: nodes[i].id,
    target: n.id,
    sourceHandle: "right",
    targetHandle: "left",
  }));
  return { nodes, edges };
}
