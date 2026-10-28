"use client";

import { useId } from "react";
import { parseDescription } from "@/lib/checklist";
import { flowCategories, getFlow } from "@/lib/diagram-storage";
import { hasCustomArchitectureLayers } from "@/lib/project-stack";
import type { ProjectRecord } from "@/lib/projects";
import type { StoredWorkItem } from "@/lib/work-items-storage";
import { useHealth } from "./use-health";

export type RadarScores = { uptime: number; velocity: number; checklists: number; architecture: number; flows: number };

const AXES: { key: keyof RadarScores; label: string }[] = [
  { key: "uptime", label: "Uptime" },
  { key: "velocity", label: "Velocity" },
  { key: "checklists", label: "Checklists" },
  { key: "architecture", label: "Architecture" },
  { key: "flows", label: "Flows" },
];

const CENTER = 150;
const RADIUS = 92;
const RINGS = [0.2, 0.4, 0.6, 0.8, 1];
const FLOW_STEPS_FOR_FULL_SCORE = 18; // six steps in each of the three flows

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Engineering level of a project: 50 XP per finished task and 10 per open one, 100 XP per level.
export const projectLevel = (items: StoredWorkItem[] | null) => {
  const live = (items ?? []).filter((i) => !i.deleted_at);
  const xp = live.filter((i) => i.status === "done").length * 50 + live.filter((i) => i.status !== "done").length * 10;
  return Math.floor(xp / 100) + 1;
};

// Counts the runbooks someone has actually written for this project (architecture layers and flow steps).
function writtenRunbooks(projectId: string): number {
  let count = 0;
  try {
    const prefix = `collab-workspace:runbook:${projectId}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && localStorage.getItem(key)?.trim()) count++;
    }
  } catch {
    // storage blocked: no runbooks can be seen
  }
  return count;
}

// Five 0-100 scores. `uptimePercent` is the share of recent health checks that passed (null with no history yet)
// and `online` says whether the latest check succeeded.
export function computeRadarScores(
  project: ProjectRecord,
  items: StoredWorkItem[],
  health: { online: boolean; uptimePercent: number | null }
): RadarScores {
  const live = items.filter((i) => !i.deleted_at);
  const parsed = live.map((i) => parseDescription(i.description));
  const stackDeclared = Boolean(project.frontend_stack.trim() || project.backend_stack.trim());
  const flowSteps = flowCategories.reduce((sum, c) => sum + getFlow(project.id, c.value).steps.length, 0);

  return {
    uptime: !project.live_url ? 0 : (health.uptimePercent ?? (health.online ? 100 : 0)),
    velocity: live.length ? clamp((live.filter((i) => i.status === "done").length / live.length) * 100) : 0,
    checklists: live.length ? clamp((parsed.filter((p) => p.tasks.length > 0 || p.label).length / live.length) * 100) : 0,
    architecture: clamp((stackDeclared ? 20 : 0) + (hasCustomArchitectureLayers(project.id) ? 30 : 0) + Math.min(50, writtenRunbooks(project.id) * 10)),
    flows: clamp((flowSteps / FLOW_STEPS_FOR_FULL_SCORE) * 100),
  };
}

const point = (axis: number, fraction: number) => {
  const angle = -Math.PI / 2 + (axis * 2 * Math.PI) / AXES.length;
  return { x: CENTER + Math.cos(angle) * RADIUS * fraction, y: CENTER + Math.sin(angle) * RADIUS * fraction };
};
const polygon = (fractions: number[]) => fractions.map((f, i) => `${point(i, f).x.toFixed(1)},${point(i, f).y.toFixed(1)}`).join(" ");

// Pure-SVG radar: pentagon rings every 20%, spokes to each axis, and the project's scores as a filled polygon.
export function RadarChart({ scores, title }: { scores: RadarScores; title: string }) {
  const gradientId = useId();
  const values = AXES.map((a) => scores[a.key] / 100);

  return (
    <svg viewBox="0 0 300 300" role="img" aria-label={`${title}: ${AXES.map((a) => `${a.label} ${scores[a.key]}`).join(", ")}`} className="mx-auto h-auto w-full max-w-xs">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {RINGS.map((r) => (
        <polygon key={r} points={polygon(AXES.map(() => r))} fill="none" className="stroke-neutral-200" strokeWidth="1" />
      ))}
      {AXES.map((a, i) => (
        <line key={a.key} x1={CENTER} y1={CENTER} x2={point(i, 1).x} y2={point(i, 1).y} className="stroke-neutral-200" strokeWidth="1" />
      ))}
      <polygon points={polygon(values)} fill={`url(#${gradientId})`} strokeWidth="2" strokeLinejoin="round" className="stroke-red-500" />
      {values.map((v, i) => (
        <circle key={AXES[i].key} cx={point(i, v).x} cy={point(i, v).y} r="3.5" className="fill-red-500 stroke-white" strokeWidth="1.5" />
      ))}
      {AXES.map((a, i) => {
        const p = point(i, 1.2);
        const anchor = Math.abs(p.x - CENTER) < 4 ? "middle" : p.x > CENTER ? "start" : "end";
        return (
          <text key={a.key} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" className="text-[11px]">
            <tspan className="fill-neutral-500">{a.label} </tspan>
            <tspan className="fill-neutral-900 font-semibold">{scores[a.key]}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

// The radar for one project, with its live uptime read from the health monitor.
export default function PokedexRadar({ project, items }: { project: ProjectRecord; items: StoredWorkItem[] | null }) {
  const { health, uptimePercent } = useHealth(project.live_url);
  const scores = computeRadarScores(project, items ?? [], { online: health.state === "online", uptimePercent });

  return (
    <div>
      <RadarChart scores={scores} title={`${project.name} technical radar`} />
      <p className="mt-1 text-center text-xs text-neutral-500">
        Uptime from recent health checks · Velocity = done ÷ total · Checklists = tasks with sub-tasks or labels · Architecture = stack,
        edited layers and runbooks · Flows = process steps documented
      </p>
    </div>
  );
}
