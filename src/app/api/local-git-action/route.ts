import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { FLEET_PATHS, isLocalhost } from "@/lib/fleet-paths";

// The only route that writes to a repo, and only to its remote: two whitelisted git commands, no user-supplied
// arguments, arguments passed as an array (never a shell), localhost only.

const run = promisify(execFile);

const TIMEOUT_MS = 15_000;
const MAX_OUTPUT = 4000;
const ACTIONS = ["push", "fetch"] as const;
type Action = (typeof ACTIONS)[number];

// One push or fetch per repo at a time, so a double click cannot start two.
const busy = new Set<string>();

const fail = (error: string, status: number, stderr?: string) => Response.json({ ok: false, error, ...(stderr ? { stderr } : {}) }, { status });

// Remote URLs can carry credentials (https://user:token@host/...), and git echoes them in some errors.
const scrub = (text: string) => text.replace(/:\/\/[^/@\s]+@/g, "://***@").slice(0, MAX_OUTPUT);

type GitResult = { ok: true; stdout: string; stderr: string } | { ok: false; stdout: string; stderr: string; message: string };

async function git(cwd: string, args: string[]): Promise<GitResult> {
  try {
    const { stdout, stderr } = await run("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      // Fail instead of waiting on a credential prompt nobody can answer.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, stdout, stderr };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; killed?: boolean; message?: string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      message: err.killed ? `git timed out after ${TIMEOUT_MS / 1000}s` : "git command failed",
    };
  }
}

const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// The first candidate folder that is itself the root of a git work tree.
async function resolveRepoCwd(projectId: string): Promise<string | null> {
  const candidates = FLEET_PATHS[projectId];
  if (!candidates) return null;
  for (const candidate of candidates) {
    const top = await git(candidate, ["rev-parse", "--show-toplevel"]);
    if (top.ok && same(top.stdout.trim(), candidate)) return candidate;
  }
  return null;
}

function parseBody(value: unknown): { project: string; action: Action } | null {
  if (typeof value !== "object" || value === null) return null;
  const { project, action } = value as Record<string, unknown>;
  if (typeof project !== "string" || typeof action !== "string") return null;
  if (!Object.hasOwn(FLEET_PATHS, project)) return null;
  const known = ACTIONS.find((a) => a === action);
  return known ? { project, action: known } : null;
}

// { project, action: "push" | "fetch" } -> runs `git push origin <current branch>` or `git fetch origin`.
export async function POST(request: Request) {
  if (!isLocalhost(request.headers.get("host"))) return fail("Git actions only run in a local dev environment", 403);

  // A page on another site could make the browser POST here. Browsers always send Origin on cross-site POSTs;
  // and requiring JSON forces a CORS preflight that this route never approves.
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // unparsable origin: rejected below
    }
    if (!originHost || originHost !== request.headers.get("host")) return fail("Cross-origin request refused", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail("Expected a JSON body", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const parsed = parseBody(body);
  if (!parsed) return fail("Expected { project: <fleet project id>, action: \"push\" | \"fetch\" }", 400);

  const cwd = await resolveRepoCwd(parsed.project);
  if (!cwd) return fail("Git repository not found on this machine", 404);

  if (busy.has(cwd)) return fail("Another git action is already running for this repository", 409);
  busy.add(cwd);
  try {
    let args: string[];
    if (parsed.action === "push") {
      const head = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = head.ok ? head.stdout.trim() : "";
      if (!branch || branch === "HEAD" || branch.startsWith("-")) return fail("No branch is checked out (detached HEAD), so there is nothing to push", 400);
      args = ["push", "origin", branch];
    } else {
      args = ["fetch", "origin"];
    }

    const result = await git(cwd, args);
    if (!result.ok) {
      const detail = scrub(result.stderr || result.stdout);
      return fail(detail.trim().split("\n").filter(Boolean).pop() ?? result.message, 500, detail);
    }
    return Response.json({ ok: true, action: parsed.action, stdout: scrub(result.stdout), stderr: scrub(result.stderr) });
  } finally {
    busy.delete(cwd);
  }
}
