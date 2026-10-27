import { getProjects } from "./projects";
import { mockUser } from "./mock-data";

export type NodeType = "frame" | "rectangle" | "text" | "button";
export type Direction = "row" | "column";
export type Align = "start" | "center" | "end";
export type Distribute = "start" | "center" | "end" | "between";
export type SizeMode = "fixed" | "hug";

// One layer on the canvas. Only top-level frames use x/y; everything nested is placed by its
// parent's flexbox settings. For text layers, fill is the text colour.
export type CanvasNode = {
  id: string;
  type: NodeType;
  name: string;
  text: string;
  fontSize: number;
  x: number;
  y: number;
  direction: Direction;
  gap: number;
  padding: number;
  align: Align;
  distribute: Distribute;
  widthMode: SizeMode;
  heightMode: SizeMode;
  width: number;
  height: number;
  fill: string;
  linkedTaskId: string | null;
  children: CanvasNode[];
};

export type DesignFile = {
  id: string;
  project_id: string;
  name: string;
  updated_by: string;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  nodes: CanvasNode[];
};

const storageKey = "collab-workspace:design-files";

const nodeDefaults: Record<NodeType, Partial<CanvasNode>> = {
  frame: { name: "Frame", fill: "#ffffff", widthMode: "hug", heightMode: "hug", padding: 16, gap: 8 },
  rectangle: { name: "Rectangle", fill: "#c7d2fe", widthMode: "fixed", heightMode: "fixed", width: 100, height: 100 },
  text: { name: "Text", text: "Text", fill: "#111827" },
  button: { name: "Button", text: "Button", fill: "#4f46e5", padding: 10 },
};

export function makeNode(type: NodeType, overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id: crypto.randomUUID(),
    type,
    name: type,
    text: "",
    fontSize: 16,
    x: 0,
    y: 0,
    direction: "column",
    gap: 0,
    padding: 0,
    align: "start",
    distribute: "start",
    widthMode: "hug",
    heightMode: "hug",
    width: 0,
    height: 0,
    fill: "#ffffff",
    linkedTaskId: null,
    children: [],
    ...nodeDefaults[type],
    ...overrides,
  };
}

export function findNode(nodes: CanvasNode[], id: string): CanvasNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}

export function findParentId(nodes: CanvasNode[], id: string, parentId: string | null = null): string | null {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    const hit = findParentId(node.children, id, node.id);
    if (hit) return hit;
  }
  return null;
}

export function updateNode(nodes: CanvasNode[], id: string, patch: Partial<CanvasNode>): CanvasNode[] {
  return nodes.map((n) =>
    n.id === id ? { ...n, ...patch } : n.children.length ? { ...n, children: updateNode(n.children, id, patch) } : n
  );
}

export function addChildNode(nodes: CanvasNode[], parentId: string, child: CanvasNode): CanvasNode[] {
  return nodes.map((n) =>
    n.id === parentId ? { ...n, children: [...n.children, child] } : { ...n, children: addChildNode(n.children, parentId, child) }
  );
}

// A static starter mockup of the quiz and bubble sheet screens for the Exam Reviewer App.
function seedExamReviewerDesign(): DesignFile {
  let n = 0;
  const node = (type: NodeType, overrides: Partial<CanvasNode> = {}) =>
    makeNode(type, { id: `seed-node-${++n}`, ...overrides });
  const heading = (text: string, fontSize: number, fill = "#111827") => node("text", { name: text, text, fontSize, fill });

  const options = [
    ["A", "ARP"],
    ["B", "DNS"],
    ["C", "DHCP"],
    ["D", "ICMP"],
  ].map(([letter, label]) =>
    node("frame", {
      name: `Option ${letter}`,
      direction: "row",
      gap: 12,
      padding: 12,
      align: "center",
      fill: "#eef2ff",
      widthMode: "fixed",
      width: 832,
      children: [node("rectangle", { name: "Bubble", width: 20, height: 20 }), heading(`${letter}. ${label}`, 16)],
    })
  );

  const sheetRows = [1, 2, 3, 4, 5].map((q) =>
    node("frame", {
      name: `Row ${q}`,
      direction: "row",
      gap: 8,
      align: "center",
      padding: 0,
      fill: "#ffffff",
      children: [
        heading(String(q), 14, "#6b7280"),
        ...["A", "B", "C", "D"].map((l) => node("rectangle", { name: `Bubble ${l}`, width: 24, height: 24, fill: "#e5e7eb" })),
      ],
    })
  );

  const header = node("frame", {
    name: "Header",
    direction: "row",
    gap: 16,
    padding: 24,
    align: "center",
    distribute: "between",
    widthMode: "fixed",
    width: 1440,
    children: [
      heading("Exam Reviewer", 24),
      heading("ITPEC FE · Mock Exam 1", 14, "#6b7280"),
      node("button", { name: "Submit", text: "Submit" }),
    ],
  });

  const questionCard = node("frame", {
    name: "Question Card",
    gap: 16,
    padding: 24,
    widthMode: "fixed",
    width: 880,
    children: [
      heading("Question 1 of 40", 14, "#6b7280"),
      heading("Which protocol resolves an IP address to a MAC address?", 20),
      ...options,
    ],
  });

  const bubbleSheet = node("frame", {
    name: "Bubble Sheet",
    gap: 12,
    padding: 24,
    widthMode: "fixed",
    width: 360,
    linkedTaskId: "seed-exam-reviewer-app-1",
    children: [heading("Answer Sheet", 18), ...sheetRows],
  });

  const body = node("frame", {
    name: "Body",
    direction: "row",
    gap: 32,
    padding: 32,
    fill: "#f9fafb",
    widthMode: "fixed",
    heightMode: "fixed",
    width: 1440,
    height: 823,
    children: [questionCard, bubbleSheet],
  });

  const screen = node("frame", {
    name: "Quiz Screen",
    gap: 0,
    padding: 0,
    fill: "#f9fafb",
    widthMode: "fixed",
    heightMode: "fixed",
    width: 1440,
    height: 900,
    children: [header, body],
  });

  return {
    id: "seed-design-quiz-ui",
    project_id: "exam-reviewer-app",
    name: "Exam Reviewer — Quiz & Bubble Sheet UI",
    updated_by: mockUser.name,
    updated_at: "2026-10-26T09:00:00.000Z",
    created_at: "2026-10-26T09:00:00.000Z",
    deleted_at: null,
    nodes: [screen],
  };
}

// A static starter mockup of the Grade Encoding Assistant: setup card, results table and actions.
function seedGradeAssistantDesign(): DesignFile {
  let n = 0;
  const node = (type: NodeType, overrides: Partial<CanvasNode> = {}) =>
    makeNode(type, { id: `seed-mgea-node-${++n}`, ...overrides });
  const text = (value: string, fontSize: number, fill = "#111827") => node("text", { name: value, text: value, fontSize, fill });

  const cell = (value: string, width: number, fill = "#111827") =>
    node("frame", {
      name: `Cell ${value}`,
      padding: 10,
      fill: "#ffffff",
      widthMode: "fixed",
      width,
      children: [text(value, 14, fill)],
    });
  const columns = [320, 200, 200, 200];
  const row = (name: string, values: string[], fill?: string) =>
    node("frame", {
      name,
      direction: "row",
      gap: 0,
      padding: 0,
      fill: "#ffffff",
      children: values.map((v, i) => cell(v, columns[i], fill)),
    });

  const header = node("frame", {
    name: "Header",
    direction: "row",
    padding: 24,
    align: "center",
    distribute: "between",
    widthMode: "fixed",
    width: 1440,
    children: [text("Mastersoft Grade Encoding Assistant · AY 2026-2027", 24)],
  });

  const setupCard = node("frame", {
    name: "Setup Card",
    gap: 8,
    padding: 24,
    widthMode: "fixed",
    width: 960,
    children: [text("Assessment Setup", 18), text("CS: 50% · WE: 50% · Transmutation: Step Table", 14, "#6b7280")],
  });

  const table = node("frame", {
    name: "Spreadsheet Table",
    gap: 0,
    padding: 0,
    fill: "#e5e7eb",
    children: [
      row("Header Row", ["Student", "Raw Marks", "Transmuted %", "Final Rating"], "#6b7280"),
      row("Juan Dela Cruz", ["Juan Dela Cruz", "87 / 100", "92", "1.75"]),
      row("Maria Santos", ["Maria Santos", "94 / 100", "96", "1.25"]),
    ],
  });

  const actions = node("frame", {
    name: "Actions",
    direction: "row",
    gap: 12,
    padding: 0,
    fill: "#f9fafb",
    children: [
      node("button", { name: "Export", text: "Export Upload .xlsx" }),
      node("button", { name: "Save", text: "Save to IndexedDB", fill: "#111827" }),
    ],
  });

  const body = node("frame", {
    name: "Body",
    gap: 24,
    padding: 32,
    fill: "#f9fafb",
    widthMode: "fixed",
    heightMode: "fixed",
    width: 1440,
    height: 823,
    children: [setupCard, table, actions],
  });

  const screen = node("frame", {
    name: "Gradebook Screen",
    gap: 0,
    padding: 0,
    fill: "#f9fafb",
    widthMode: "fixed",
    heightMode: "fixed",
    width: 1440,
    height: 900,
    children: [header, body],
  });

  return {
    id: "seed-design-grade-ui",
    project_id: "mastersoft-grade-encoding-assistant",
    name: "Grade Encoding Assistant — Gradebook UI",
    updated_by: mockUser.name,
    updated_at: "2026-10-27T09:00:00.000Z",
    created_at: "2026-10-27T09:00:00.000Z",
    deleted_at: null,
    nodes: [screen],
  };
}

const seedDesigns = () => [seedExamReviewerDesign(), seedGradeAssistantDesign()];

// Returns every file, including soft-deleted ones, so saving never drops them. Seed files that have not been
// saved yet are merged in, each belonging to exactly one project.
export function loadDesignFiles(): DesignFile[] {
  let stored: DesignFile[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) stored = parsed;
    }
  } catch {
    // corrupt JSON or storage unavailable: fall back to the seed data
  }
  return [...stored, ...seedDesigns().filter((s) => !stored.some((f) => f.id === s.id))];
}

export function loadDesignFile(id: string): DesignFile | null {
  return loadDesignFiles().find((f) => f.id === id) ?? null;
}

// Replaces the file with the same id (or appends it). Returns false if storage is unavailable.
export function saveDesignFile(file: DesignFile): boolean {
  try {
    const files = loadDesignFiles();
    const next = files.some((f) => f.id === file.id) ? files.map((f) => (f.id === file.id ? file : f)) : [...files, file];
    localStorage.setItem(storageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function createDesignFile(projectId: string, name: string): DesignFile {
  const now = new Date().toISOString();
  const file: DesignFile = {
    id: crypto.randomUUID(),
    project_id: projectId,
    name: name.trim(),
    updated_by: mockUser.name,
    updated_at: now,
    created_at: now,
    deleted_at: null,
    nodes: [
      makeNode("frame", {
        name: "Frame 1",
        widthMode: "fixed",
        heightMode: "fixed",
        width: 1440,
        height: 900,
        padding: 32,
        gap: 16,
      }),
    ],
  };
  saveDesignFile(file);
  return file;
}

// The project's primary design file: its first live file, or a new starter frame named after the project.
export function getProjectDesignFile(projectId: string): DesignFile {
  const existing = loadDesignFiles().find((f) => f.project_id === projectId && !f.deleted_at);
  if (existing) return existing;

  const project = getProjects().find((p) => p.id === projectId);
  const file = createDesignFile(projectId, `${project?.name ?? projectId} — UI`);
  const title = makeNode("text", {
    name: "Project name",
    text: project?.name ?? projectId,
    fontSize: 28,
    fill: "#111827",
  });
  const identifier = makeNode("text", {
    name: "Identifier",
    text: project?.identifier ?? projectId.slice(0, 3).toUpperCase(),
    fontSize: 14,
    fill: "#6b7280",
  });
  const withContent: DesignFile = {
    ...file,
    nodes: file.nodes.map((frame) => ({ ...frame, name: "Home Screen", children: [title, identifier] })),
  };
  saveDesignFile(withContent);
  return withContent;
}
