import { getProjects, projectColumns, SEED_PROJECTS } from "./projects";
import { supabase } from "./supabase";

// Routes use the local project ids ("exam-reviewer-app"); the database has uuids. A project is matched by
// its identifier within the workspace and created on first use.
const cache = new Map<string, Promise<string>>();

type Found = { id: string; github_url: string | null; live_url: string | null };

async function lookup(workspaceId: string, identifier: string): Promise<Found | null> {
  const { data, error } = await supabase!
    .from("projects")
    .select("id, github_url, live_url")
    .eq("workspace_id", workspaceId)
    .eq("identifier", identifier)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function resolve(workspaceId: string, localProjectId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const known = getProjects().find((p) => p.id === localProjectId);
  if (!known) throw new Error(`Unknown project "${localProjectId}".`);

  const existing = await lookup(workspaceId, known.identifier);
  if (existing) {
    // A seeded project created by an older version has a bare cloud row: fill it in, without blocking the caller.
    const seeded = SEED_PROJECTS.some((s) => s.identifier === known.identifier);
    if (seeded && (existing.github_url === null || existing.live_url === null)) {
      void supabase.from("projects").update(projectColumns(known)).eq("id", existing.id).then(
        () => undefined,
        () => undefined // best effort: the next visit retries
      );
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, identifier: known.identifier, ...projectColumns(known) })
    .select("id")
    .single();
  if (!error) return data.id;
  // Lost a race with another tab, or the identifier is taken by a soft-deleted project.
  if (error.code === "23505") {
    const raced = await lookup(workspaceId, known.identifier);
    if (raced) return raced.id;
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
