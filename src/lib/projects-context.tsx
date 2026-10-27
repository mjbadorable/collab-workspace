"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import CreateProjectDialog from "@/components/projects/create-project-dialog";
import {
  createLocalProject,
  deleteLocalProject,
  ensureSeedProjects,
  fetchCloudProjects,
  getProjectDiagrams,
  getProjects,
  mergeRemoteProjects,
  pushCloudProject,
  removeCloudProject,
  SEED_PROJECTS,
  subscribeProjects,
  updateLocalProject,
  type ProjectDiagram,
  type ProjectInput,
  type ProjectRecord,
} from "./projects";
import { useStorageTarget } from "./storage-target";

type ProjectsContext = {
  projects: ProjectRecord[];
  currentProject: ProjectRecord | null;
  createProject: (input: ProjectInput) => ProjectRecord;
  updateProject: (id: string, patch: Partial<Omit<ProjectRecord, "id" | "created_at">>) => void;
  deleteProject: (id: string) => void;
  getProjectDiagrams: (projectId: string) => ProjectDiagram[];
  openCreateDialog: () => void;
  // Last failed cloud mirror (e.g. supabase/projects.sql not run yet). The local copy is always saved.
  syncError: string | null;
};

const Ctx = createContext<ProjectsContext | null>(null);

export function useProjects(): ProjectsContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
  return ctx;
}

// Reads the pathname, so it must sit under a Suspense boundary (AppShell provides one).
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const projects = useSyncExternalStore(subscribeProjects, getProjects, () => SEED_PROJECTS);
  const pathname = usePathname();
  const target = useStorageTarget();
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  const [syncError, setSyncError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const segment = pathname.startsWith("/projects/") ? pathname.split("/")[2] : null;
  const currentProject = segment ? (projects.find((p) => p.id === segment) ?? null) : null;

  // Older saved registries gain the seeded projects (once).
  useEffect(() => {
    ensureSeedProjects();
  }, []);

  // Pull projects other devices created in this workspace.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchCloudProjects(workspaceId).then(
      (rows) => {
        if (cancelled) return;
        mergeRemoteProjects(rows);
        setSyncError(null);
      },
      (e) => {
        if (!cancelled) setSyncError(e instanceof Error ? e.message : "Could not load cloud projects.");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const mirror = useCallback((run: (workspaceId: string) => Promise<void>) => {
    if (!workspaceId) return;
    run(workspaceId).then(
      () => setSyncError(null),
      (e) => setSyncError(e instanceof Error ? e.message : "Could not sync the project to the cloud.")
    );
  }, [workspaceId]);

  const createProject = useCallback(
    (input: ProjectInput) => {
      const record = createLocalProject(input);
      mirror((ws) => pushCloudProject(ws, record));
      return record;
    },
    [mirror]
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Omit<ProjectRecord, "id" | "created_at">>) => {
      updateLocalProject(id, patch);
      const next = getProjects().find((p) => p.id === id);
      if (next) mirror((ws) => pushCloudProject(ws, next));
    },
    [mirror]
  );

  const deleteProject = useCallback(
    (id: string) => {
      const doomed = getProjects().find((p) => p.id === id);
      deleteLocalProject(id);
      if (doomed) mirror((ws) => removeCloudProject(ws, doomed.identifier));
    },
    [mirror]
  );

  const openCreateDialog = useCallback(() => setCreateOpen(true), []);

  const value = useMemo(
    () => ({
      projects,
      currentProject,
      createProject,
      updateProject,
      deleteProject,
      getProjectDiagrams,
      openCreateDialog,
      syncError,
    }),
    [projects, currentProject, createProject, updateProject, deleteProject, openCreateDialog, syncError]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Ctx.Provider>
  );
}
