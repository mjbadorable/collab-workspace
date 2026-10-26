import type { Edge } from "@xyflow/react";
import type { DiagramNode } from "@/components/diagrams/nodes";

export type StoredDiagram = { nodes: DiagramNode[]; edges: Edge[] };

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

export function saveDiagram(projectId: string, diagram: StoredDiagram): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(diagram));
  } catch {
    // quota exceeded or storage blocked: the editor keeps working in memory
  }
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
