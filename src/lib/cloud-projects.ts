import { getProjects } from "./projects";
import { supabase } from "./supabase";

// Routes use the local project ids ("exam-reviewer-app"); the database has uuids. A project is matched by
// its identifier within the workspace and created on first use.
const cache = new Map<string, Promise<string>>();

async function lookup(workspaceId: string, identifier: string): Promise<string | null> {
  const { data, error } = await supabase!
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("identifier", identifier)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function resolve(workspaceId: string, localProjectId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const known = getProjects().find((p) => p.id === localProjectId);
  if (!known) throw new Error(`Unknown project "${localProjectId}".`);

  const existing = await lookup(workspaceId, known.identifier);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name: known.name, identifier: known.identifier })
    .select("id")
    .single();
  if (!error) return data.id;
  // Lost a race with another tab, or the identifier is taken by a soft-deleted project.
  if (error.code === "23505") {
    const raced = await lookup(workspaceId, known.identifier);
    if (raced) return raced;
    throw new Error(`The ${known.identifier} project is in the trash. Restore it first.`);
  }
  throw new Error(error.message);
}

export function ensureCloudProject(workspaceId: string, localProjectId: string): Promise<string> {
  const key = `${workspaceId}:${localProjectId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = resolve(workspaceId, localProjectId);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}
