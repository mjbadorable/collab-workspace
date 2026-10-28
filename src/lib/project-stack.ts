import type { ProjectRecord } from "./projects";

export const splitStack = (stack: string) =>
  stack
    .split(/,(?![^(]*\))/) // commas inside parentheses stay put: "IndexedDB (Dexie.js, v4)"
    .map((t) => t.trim())
    .filter(Boolean);

const HOSTS: [RegExp, string][] = [
  [/(\.web\.app|\.firebaseapp\.com)$/, "Firebase Hosting"],
  [/\.vercel\.app$/, "Vercel"],
  [/\.netlify\.app$/, "Netlify"],
  [/\.pages\.dev$/, "Cloudflare Pages"],
  [/\.github\.io$/, "GitHub Pages"],
];

export function hostingOf(liveUrl: string): string | null {
  try {
    const host = new URL(liveUrl).hostname;
    return HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? host;
  } catch {
    return null;
  }
}

export function devopsTech(project: ProjectRecord): string {
  const parts = [];
  if (project.github_url) parts.push("GitHub");
  const host = hostingOf(project.live_url);
  if (host) parts.push(host);
  parts.push("Silph DevOps health checks");
  return parts.join(", ");
}

export type TechRow = { layer: string; tech: string; role: string };

export function techRows(project: ProjectRecord): TechRow[] {
  return [
    {
      layer: "Frontend",
      tech: project.frontend_stack || "Not specified yet",
      role: "Renders the interface, handles interaction and keeps short-lived UI state in the browser.",
    },
    {
      layer: "Backend / Storage",
      tech: project.backend_stack || "Not specified yet",
      role: "Persists data and keeps the app usable offline; no data leaves the device unless a sync service is listed.",
    },
    {
      layer: "DevOps & Hosting",
      tech: devopsTech(project),
      role: "Source control, production hosting, and the live uptime and latency checks shown on this project.",
    },
  ];
}

export type ArchitectureLayer = {
  id: string;
  title: string;
  tag: string;
  summary: string;
  tech: string[];
  flow: string;
};

const STATE_PATTERN = /zustand|redux|jotai|pinia|react query|tanstack|context|swr|dexie-react-hooks/i;
const WORKER_PATTERN = /worker|pdf\.?js|wasm|webassembly|fflate|sheetjs|engine|ffmpeg/i;

// ---- custom layers: a project's edited layers replace the derived ones

const customLayersKey = (projectId: string) => `collab-workspace:custom-architecture:${projectId}`;
const LAYER_IDS = ["ui", "state", "engine", "storage"];

const isLayer = (v: unknown): v is ArchitectureLayer => {
  if (typeof v !== "object" || v === null) return false;
  const l = v as ArchitectureLayer;
  return (
    typeof l.id === "string" &&
    typeof l.title === "string" &&
    typeof l.tag === "string" &&
    typeof l.summary === "string" &&
    typeof l.flow === "string" &&
    Array.isArray(l.tech) &&
    l.tech.every((t) => typeof t === "string")
  );
};

function readCustomLayers(projectId: string): ArchitectureLayer[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(customLayersKey(projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Exactly the four known layers, in order; anything else means the saved data is not usable.
    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(isLayer) && parsed.every((l, i) => l.id === LAYER_IDS[i])) return parsed;
  } catch {
    // corrupt JSON or storage blocked: use the derived layers
  }
  return null;
}

export const hasCustomArchitectureLayers = (projectId: string) => readCustomLayers(projectId) !== null;

export function saveCustomArchitectureLayers(projectId: string, layers: ArchitectureLayer[]): void {
  try {
    localStorage.setItem(customLayersKey(projectId), JSON.stringify(layers));
  } catch {
    // storage blocked: the edit lasts until the page is reloaded
  }
}

export function resetCustomArchitectureLayers(projectId: string): void {
  try {
    localStorage.removeItem(customLayersKey(projectId));
  } catch {
    // nothing stored to remove
  }
}

// The four decoupled layers: the project's saved edits if it has any (in the browser), else derived from its stack.
export function architectureLayers(project: ProjectRecord): ArchitectureLayer[] {
  return readCustomLayers(project.id) ?? deriveLayers(project);
}

// Describes the four decoupled layers from whatever stack the project declares.
function deriveLayers(project: ProjectRecord): ArchitectureLayer[] {
  const front = splitStack(project.frontend_stack);
  const back = splitStack(project.backend_stack);
  const all = [...front, ...back];
  const state = all.filter((t) => STATE_PATTERN.test(t));
  const workers = all.filter((t) => WORKER_PATTERN.test(t));
  const storage = back.filter((t) => !WORKER_PATTERN.test(t) || /service worker/i.test(t));

  return [
    {
      id: "ui",
      title: "Presentation & Workspace UI",
      tag: "Layer 1",
      summary: "What the user sees and touches: screens, forms, canvases and navigation.",
      tech: front.length ? front : ["Not specified yet"],
      flow: "User input → UI events",
    },
    {
      id: "state",
      title: "Application & State Services",
      tag: "Layer 2",
      summary: "Business rules, validation and state that screens share, kept separate from rendering.",
      tech: state.length ? state : ["Component state & hooks"],
      flow: "UI events → state updates & domain logic",
    },
    {
      id: "engine",
      title: "Off-Main-Thread Workers / Engine",
      tag: "Layer 3",
      summary: "Heavy or isolated work (parsing, rendering, computation) kept off the UI thread.",
      tech: workers.length ? workers : ["No dedicated worker layer yet"],
      flow: "Domain logic → computation",
    },
    {
      id: "storage",
      title: "Storage & Offline Cache",
      tag: "Layer 4",
      summary: "Where data lives between visits, and how the app keeps working without a network.",
      tech: storage.length ? storage : ["Not specified yet"],
      flow: "Results → persisted data & cache",
    },
  ];
}
