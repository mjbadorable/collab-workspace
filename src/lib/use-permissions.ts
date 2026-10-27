import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { fetchMembers, type Member } from "./members";
import type { WorkspaceMember } from "./database.types";

type Loaded = { workspaceId: string; members: Member[] };

// The members of a cloud workspace; null while loading. Without a workspaceId (local preview) there is nothing to load.
export function useWorkspaceMembers(workspaceId: string | null): Member[] | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchMembers(workspaceId).then(
      (members) => {
        if (!cancelled) setLoaded({ workspaceId, members });
      },
      // A failed lookup leaves the list empty, which grants no admin rights.
      () => {
        if (!cancelled) setLoaded({ workspaceId, members: [] });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return workspaceId && loaded?.workspaceId === workspaceId ? loaded.members : null;
}

export type WorkspacePermissions = { isAdmin: boolean; role: WorkspaceMember["role"]; loading: boolean };

// Cloud: the signed-in user's role in workspace_members. Local preview (no workspaceId): always admin.
// While the role is loading (or unknown) a cloud user is treated as a plain member, so gated actions stay off.
export function useWorkspacePermissions(workspaceId: string | null): WorkspacePermissions {
  const { user } = useAuth();
  const members = useWorkspaceMembers(workspaceId);

  if (!workspaceId) return { isAdmin: true, role: "admin", loading: false };
  const isAdmin = members?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  return { isAdmin, role: isAdmin ? "admin" : "member", loading: members === null };
}
