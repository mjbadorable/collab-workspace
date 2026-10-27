import type { WorkspaceMember } from "./database.types";
import { supabase } from "./supabase";

export type Member = { user_id: string; email: string; role: WorkspaceMember["role"]; joined_at: string };

// Where an invitee goes to create an account / sign in.
export const INVITE_LINK = "https://collab-workspace-mu.vercel.app/login";

const inviteErrors: Record<string, string> = {
  user_not_found: "User not found. Ask your friend to create an account first, then invite them.",
  already_member: "That person is already a member of this workspace.",
  not_authorized: "Only workspace admins can invite members.",
  not_authenticated: "You need to be signed in to invite members.",
  invalid_role: "Choose Member or Admin.",
};

export async function fetchMembers(workspaceId: string): Promise<Member[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("list_workspace_members", { ws_id: workspaceId });
  if (error) throw new Error(error.message);
  return data;
}

// Resolves to an error message, or null when the member was added.
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: WorkspaceMember["role"]
): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  try {
    const { error } = await supabase.rpc("invite_workspace_member", {
      ws_id: workspaceId,
      invite_email: email,
      member_role: role,
    });
    if (!error) return null;
    // The SQL raises short codes; anything else (e.g. the function isn't deployed yet) is shown as-is.
    return inviteErrors[error.message] ?? error.message;
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}
