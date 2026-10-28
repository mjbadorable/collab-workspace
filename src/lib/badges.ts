import { useEffect, useMemo, useState } from "react";
import { parseDescription } from "./checklist";
import { getCycles } from "./cycles";
import { useProjects } from "./projects-context";
import type { ProjectRecord } from "./projects";
import { useIsClient } from "./use-is-client";
import { loadWorkItems } from "./work-items-storage";

export type BadgeId = "boulder" | "cascade" | "thunder" | "rainbow" | "soul" | "marsh" | "volcano" | "earth";

export type BadgeDef = {
  id: BadgeId;
  name: string;
  gym: string;
  description: string; // what earns it
  color: string; // the badge's accent colour
  path: string; // vector shape, drawn in a 24 x 24 box
};

export const GYM_BADGES: BadgeDef[] = [
  { id: "boulder", name: "Boulder Badge", gym: "Pewter Gym", description: "Lead 3+ active engineering projects", color: "#a8a29e", path: "M12 2l8 5v10l-8 5-8-5V7z" },
  { id: "cascade", name: "Cascade Badge", gym: "Cerulean Gym", description: "Complete 10+ work items across the workspace", color: "#38bdf8", path: "M12 2C12 2 5 10 5 15a7 7 0 0014 0c0-5-7-13-7-13z" },
  { id: "thunder", name: "Thunder Badge", gym: "Vermilion Gym", description: "High Availability: live production uptime telemetry recorded", color: "#facc15", path: "M13 2L4 14h6l-1 8 9-12h-6z" },
  { id: "rainbow", name: "Rainbow Badge", gym: "Celadon Gym", description: "Quality Engineering: add sub-task checklists to 3+ tickets", color: "#34d399", path: "M12 4a9 9 0 019 9H3a9 9 0 019-9zM6 16h12v3H6z" },
  { id: "soul", name: "Soul Badge", gym: "Fuchsia Gym", description: "Agile Master: run an active Sprint Cycle", color: "#e879f9", path: "M12 2l8 10-8 10-8-10z" },
  { id: "marsh", name: "Marsh Badge", gym: "Saffron Gym", description: "Systems Architect: document custom Engineering Runbooks", color: "#fb923c", path: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 110 10 5 5 0 010-10z" },
  { id: "volcano", name: "Volcano Badge", gym: "Cinnabar Gym", description: "DevOps Integration: link Git commit hashes or PRs to tickets", color: "#f87171", path: "M12 3l10 18H2zm0 7l-3.5 7h7z" },
  { id: "earth", name: "Earth Badge", gym: "Viridian Gym", description: "Champion of the League: complete 20+ roadmap milestones", color: "#4ade80", path: "M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.1L12 17.8 5.7 21.3l1.7-7.1L2 9.5l7.1-.6z" },
];

export const XP_PER_ACTIVE_TASK = 10;
export const XP_PER_DONE_TASK = 50;
export const XP_PER_BADGE = 100;
export const XP_PER_LEVEL = 100;

export type BadgeState = BadgeDef & { unlocked: boolean };

export type WorkspaceStats = {
  projects: number;
  active: number; // open tasks
  done: number;
  withSubtasks: number;
  linkedToGit: number;
  hasOnlineCheck: boolean;
  hasActiveCycle: boolean;
  hasRunbook: boolean;
};

const hasHealthyCheck = (url: string): boolean => {
  try {
    const raw = localStorage.getItem(`collab-workspace:health-history:${url}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.some((s) => typeof s === "object" && s !== null && (s as { ok?: unknown }).ok === true);
  } catch {
    return false;
  }
};

const hasRunbookNotes = (): boolean => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("collab-workspace:runbook:") && localStorage.getItem(key)?.trim()) return true;
    }
  } catch {
    // storage blocked: no runbooks can be seen
  }
  return false;
};

// Reads the local copy of every project's board (the cloud copy is mirrored there), so it needs the browser.
export function collectStats(projects: ProjectRecord[]): WorkspaceStats {
  const items = projects.flatMap((p) => loadWorkItems(p.id).filter((i) => !i.deleted_at));
  const parsed = items.map((i) => parseDescription(i.description));
  return {
    projects: projects.length,
    active: items.filter((i) => i.status !== "done").length,
    done: items.filter((i) => i.status === "done").length,
    withSubtasks: parsed.filter((p) => p.tasks.length > 0).length,
    linkedToGit: parsed.filter((p) => p.commit || p.pr).length,
    hasOnlineCheck: projects.some((p) => p.live_url && hasHealthyCheck(p.live_url)),
    hasActiveCycle: projects.some((p) => getCycles(p.id).some((c) => c.status === "active")),
    hasRunbook: hasRunbookNotes(),
  };
}

const UNLOCKED: Record<BadgeId, (s: WorkspaceStats) => boolean> = {
  boulder: (s) => s.projects >= 3,
  cascade: (s) => s.done >= 10,
  thunder: (s) => s.hasOnlineCheck,
  rainbow: (s) => s.withSubtasks >= 3,
  soul: (s) => s.hasActiveCycle,
  marsh: (s) => s.hasRunbook,
  volcano: (s) => s.linkedToGit > 0,
  earth: (s) => s.done >= 20,
};

export function evaluateBadges(stats: WorkspaceStats) {
  const badges: BadgeState[] = GYM_BADGES.map((b) => ({ ...b, unlocked: UNLOCKED[b.id](stats) }));
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const xp = stats.active * XP_PER_ACTIVE_TASK + stats.done * XP_PER_DONE_TASK + unlockedCount * XP_PER_BADGE;
  return {
    badges,
    unlockedCount,
    xp,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    stats,
  };
}

// Badge states, XP and level for the whole workspace, or null until the page is on the client. It re-reads when
// the projects change, when another tab writes, and when the window regains focus.
export function useGymBadges() {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  return useMemo(
    () => (mounted ? evaluateBadges(collectStats(projects)) : null),
    // version is not read inside; a new value means the stored data may have changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, projects, version]
  );
}
