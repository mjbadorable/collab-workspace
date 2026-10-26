"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import type { Workspace } from "./database.types";
import { supabase } from "./supabase";

type WorkspaceContext = {
  workspaces: Workspace[];
  current: Workspace | null;
  // True while a signed-in user's workspaces haven't loaded (including after a failed fetch).
  loading: boolean;
  // Signed in, fetched, and has none: the onboarding modal should show.
  needsOnboarding: boolean;
  select: (id: string) => void;
  create: (name: string, slug: string) => Promise<string | null>;
};

const Ctx = createContext<WorkspaceContext | null>(null);

export function useWorkspaces(): WorkspaceContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspaces must be used inside WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Remembering which user the list belongs to makes "loading" derivable, with no setState in the effect body.
  const [loaded, setLoaded] = useState<{ userId: string; workspaces: Workspace[] } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from("workspaces")
      .select("*")
      .order("created_at")
      .then(({ data, error }) => {
        // A failed fetch (offline, say) stays "loading" so it never looks like an empty account and triggers onboarding.
        if (!cancelled && !error) setLoaded({ userId, workspaces: data });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ready = !!userId && loaded?.userId === userId;
  const workspaces = useMemo(() => (loaded && loaded.userId === userId ? loaded.workspaces : []), [loaded, userId]);
  const current = workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;

  const create = useCallback(
    async (name: string, slug: string): Promise<string | null> => {
      if (!supabase || !userId) return "You need to be signed in to create a workspace.";
      const { data, error } = await supabase.rpc("create_workspace", { ws_name: name, ws_slug: slug });
      if (error) {
        if (error.code === "23505") return "That slug is already taken. Try another.";
        return error.message;
      }
      setLoaded((prev) => ({ userId, workspaces: [...(prev?.userId === userId ? prev.workspaces : []), data] }));
      setSelectedId(data.id);
      return null;
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      workspaces,
      current,
      loading: !!userId && !ready,
      needsOnboarding: ready && workspaces.length === 0,
      select: setSelectedId,
      create,
    }),
    [workspaces, current, userId, ready, create]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
