import { useAuth } from "./auth-context";
import { useWorkspaces } from "./workspace-context";

// Where data lives right now: the cloud for a signed-in user with an active workspace, localStorage otherwise.
export type StorageTarget = { mode: "loading" } | { mode: "local" } | { mode: "cloud"; workspaceId: string };

export function useStorageTarget(): StorageTarget {
  const { user, loading: authLoading } = useAuth();
  const { current, loading: workspacesLoading } = useWorkspaces();
  if (authLoading || workspacesLoading) return { mode: "loading" };
  if (user && current) return { mode: "cloud", workspaceId: current.id };
  return { mode: "local" };
}
