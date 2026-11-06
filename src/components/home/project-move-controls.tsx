"use client";

import type { KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pin } from "lucide-react";
import { useProjects } from "@/lib/projects-context";

const btn =
  "rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-red-500 disabled:pointer-events-none disabled:opacity-30";

// Pin to top / move earlier / move later for one project. Index is the project's place in the full fleet order.
export function ProjectMoveControls({ projectId, name }: { projectId: string; name: string }) {
  const { projects, moveProject } = useProjects();
  const index = projects.findIndex((p) => p.id === projectId);
  const first = index <= 0;
  const last = index === projects.length - 1;
  return (
    <div role="group" aria-label={`Reorder ${name}`} className="flex items-center">
      <button type="button" className={btn} disabled={first} onClick={() => moveProject(projectId, "top")} aria-label={`Pin ${name} to top`} title="Pin to top">
        <Pin className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" className={btn} disabled={first} onClick={() => moveProject(projectId, "up")} aria-label={`Move ${name} earlier`} title="Move earlier">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" className={btn} disabled={last} onClick={() => moveProject(projectId, "down")} aria-label={`Move ${name} later`} title="Move later">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

// Drag grip. Mouse users drag the card; keyboard users focus the grip and press arrows (Home pins to top).
export function ProjectGrip({ projectId, name }: { projectId: string; name: string }) {
  const { moveProject } = useProjects();
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const dir = e.key === "ArrowUp" || e.key === "ArrowLeft" ? "up" : e.key === "ArrowDown" || e.key === "ArrowRight" ? "down" : e.key === "Home" ? "top" : null;
    if (!dir) return;
    e.preventDefault();
    moveProject(projectId, dir);
  };
  return (
    <button
      type="button"
      onKeyDown={onKeyDown}
      aria-label={`Reorder ${name}: drag, or use arrow keys to move, Home to pin to top`}
      title="Drag to reorder"
      className="cursor-grab rounded p-0.5 text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-red-500 active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
}
